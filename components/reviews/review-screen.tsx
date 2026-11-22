"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Info,
  Loader2,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { AutosaveIndicator, type AutosaveState } from "@/components/shared/autosave-indicator";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { FormField } from "@/components/shared/form-field";
import { FormSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { ReviewRecommendation, ReviewScreenDataDto } from "@/components/reviews/types";

interface Props {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
  assignmentId: string;
}

const RECOMMENDATIONS: Array<{ value: ReviewRecommendation; label: string; help: string }> = [
  { value: "ACCEPT_ORAL", label: "Accept for oral presentation", help: "Strong enough for a podium slot." },
  { value: "ACCEPT_POSTER", label: "Accept as a poster", help: "Sound work, better suited to a poster." },
  { value: "REVISE", label: "Revise and resubmit", help: "Promising, but needs changes first." },
  { value: "REJECT", label: "Reject", help: "Not suitable for this meeting." },
];

/**
 * Review screen (REV-08). Desktop: abstract left, form right. Phone: stacked,
 * with a sticky bar for total score, save state, previous/next and submit.
 * Authors/affiliations render only if the API sent them — in double-blind
 * mode the server omits them (serializeBlindSubmissionForReviewer).
 */
export function ReviewScreen({ orgId, eventId, orgSlug, eventSlug, assignmentId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ReviewScreenDataDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<ReviewRecommendation | null>(null);
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentCommittee, setCommentCommittee] = useState("");
  const [isDraft, setIsDraft] = useState(true);

  const [saveState, setSaveState] = useState<AutosaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictReason, setConflictReason] = useState("");
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [declaringConflict, setDeclaringConflict] = useState(false);
  const [openDescriptions, setOpenDescriptions] = useState<Record<string, boolean>>({});

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);
  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;
  const portal = `/${orgSlug}/${eventSlug}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<ReviewScreenDataDto>(`${base}/reviews/assignments/${assignmentId}`);
    if (res.ok) {
      const d = res.data;
      setData(d);
      setLoadError(null);
      if (d.review) {
        const scoreMap: Record<string, number> = {};
        d.review.scores.forEach((s) => {
          scoreMap[s.criterionId] = s.score;
        });
        setScores(scoreMap);
        setRecommendation(d.review.recommendation);
        setCommentAuthor(d.review.commentAuthor || "");
        setCommentCommittee(d.review.commentCommittee || "");
        setIsDraft(d.review.isDraft);
        setSaveState("saved");
      } else {
        setScores({});
        setRecommendation(null);
        setCommentAuthor("");
        setCommentCommittee("");
        setIsDraft(true);
        setSaveState("idle");
      }
    } else {
      setLoadError(res.error.message || "This review couldn't be opened.");
      if (res.status === 403) router.push(`${portal}/reviews`);
    }
    setLoading(false);
    setTimeout(() => {
      initialLoadDone.current = true;
    }, 100);
  }, [base, assignmentId, portal, router]);

  useEffect(() => {
    initialLoadDone.current = false;
    void loadData();
  }, [loadData]);

  // Save (auto-save draft or final) — unchanged endpoint and payload
  const executeSave = useCallback(
    async (asDraft: boolean, customScores?: Record<string, number>) => {
      if (!assignmentId) return false;
      const targetScores = customScores ?? scores;
      setSaveState("saving");
      const res = await apiFetch(`${base}/reviews/assignments/${assignmentId}/save`, {
        method: "PUT",
        body: {
          isDraft: asDraft,
          scores: Object.entries(targetScores).map(([criterionId, score]) => ({ criterionId, score })),
          recommendation,
          commentAuthor,
          commentCommittee,
        },
      });
      if (res.ok) {
        setSaveState("saved");
        setSavedAt(new Date());
        setIsDraft(asDraft);
        return true;
      }
      setSaveState("error");
      if (!asDraft) toast.error("Couldn't submit your review", { description: res.error.message });
      return false;
    },
    [assignmentId, base, scores, recommendation, commentAuthor, commentCommittee],
  );

  // Debounced auto-save (unchanged)
  useEffect(() => {
    if (!initialLoadDone.current || !data) return;
    if (data.assignment.status === "COMPLETED" && !isDraft) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setSaveState("saving");
    debounceTimerRef.current = setTimeout(() => {
      void executeSave(true);
    }, 600);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [scores, recommendation, commentAuthor, commentCommittee, executeSave, data, isDraft]);

  // Live weighted score (unchanged maths)
  const { currentWeightedScore, maxPossibleWeightedScore } = useMemo(() => {
    if (!data || data.rubricCriteria.length === 0) return { currentWeightedScore: 0, maxPossibleWeightedScore: 0 };
    let totalWeighted = 0;
    let totalWeight = 0;
    let maxWeighted = 0;
    data.rubricCriteria.forEach((crit) => {
      const s = scores[crit.id];
      const w = crit.weight || 1.0;
      if (s !== undefined) {
        totalWeighted += s * w;
        totalWeight += w;
      }
      maxWeighted += crit.scaleMax * w;
    });
    return {
      currentWeightedScore: totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : 0,
      maxPossibleWeightedScore: totalWeight > 0 ? Math.round((maxWeighted / totalWeight) * 100) / 100 : 0,
    };
  }, [data, scores]);

  const missingCriteria = data ? data.rubricCriteria.filter((c) => scores[c.id] === undefined) : [];
  // Submitted reviews stay editable (the API allows re-submitting), as before.
  const submitted = !!data && data.assignment.status === "COMPLETED" && !isDraft;
  const readOnly = false;

  // Same checks as before; shown in place instead of as toasts
  const requestSubmit = () => {
    if (!data) return;
    if (missingCriteria.length > 0 || !recommendation) {
      setShowMissing(true);
      const first = missingCriteria[0] ? `crit-${missingCriteria[0].id}` : "recommendation";
      document.getElementById(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitConfirmOpen(true);
  };

  const handleFinalSubmit = async () => {
    if (!data) return;
    setSubmitting(true);
    const success = await executeSave(false);
    setSubmitting(false);
    if (success) {
      toast.success("Review submitted", "Thank you.");
      setSubmitConfirmOpen(false);
      router.push(data.navigation.nextAssignmentId ? `${portal}/reviews/${data.navigation.nextAssignmentId}` : `${portal}/reviews`);
    }
  };

  const handleDeclareConflict = async () => {
    if (!conflictReason.trim()) {
      setConflictError("Say briefly why — for example, “I supervised this work”.");
      return;
    }
    setDeclaringConflict(true);
    const res = await apiFetch(`${base}/reviews/assignments/${assignmentId}/conflict`, {
      method: "POST",
      body: { reason: conflictReason.trim() },
    });
    setDeclaringConflict(false);
    if (res.ok) {
      toast.success("Conflict declared", "The track chair will reassign this abstract.");
      setConflictModalOpen(false);
      router.push(`${portal}/reviews`);
    } else {
      toast.error("Couldn't declare the conflict", { description: res.error.message });
    }
  };

  /* ─── States ─────────────────────────────────────────────────────────── */

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-5xl px-gutter py-8">
        <FormSkeleton fields={4} label="Opening the abstract…" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-gutter py-10">
        <ErrorState
          title="This review didn't open"
          description={loadError ?? undefined}
          onRetry={() => void loadData()}
          action={
            <Button asChild variant="outline">
              <Link href={`${portal}/reviews`}>Back to your reviews</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { submission, navigation } = data;
  const isConflict = data.assignment.status === "CONFLICT";
  const sections = Object.entries(submission.abstractBody ?? {});

  return (
    <div className="min-h-dvh bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-2 px-2 md:px-4">
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href={`${portal}/reviews`} aria-label="Back to your reviews">
              <ChevronLeft data-icon="inline-start" />
              <span className="hidden sm:inline">Your reviews</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1 text-sm">
            <span className="text-muted-foreground">
              Abstract {navigation.currentIndex} of {navigation.totalAssignments}
            </span>
            {submission.refNo ? <span className="ml-2 font-mono font-semibold">{submission.refNo}</span> : null}
          </div>
          {!readOnly && !isConflict ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-danger/40 text-danger-foreground"
              onClick={() => {
                setConflictReason("");
                setConflictError(null);
                setConflictModalOpen(true);
              }}
            >
              <ShieldAlert data-icon="inline-start" />
              <span className="sm:hidden">COI</span>
              <span className="hidden sm:inline">Conflict of interest</span>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-gutter py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-8 lg:py-8">
        {/* Abstract */}
        <article aria-labelledby="abstract-title" className="min-w-0">
          {submission.blindMode !== "NONE" ? (
            <p className="mb-4 flex items-start gap-2 rounded-md bg-info-tint px-3 py-2 text-sm text-info-foreground">
              <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
              {submission.blindMode === "DOUBLE"
                ? "Double-blind review: author names and affiliations are hidden from you, and yours from them."
                : "Single-blind review: authors won't know who reviewed their work."}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {[submission.submissionType?.name, submission.category?.name].filter(Boolean).join(" · ")}
            <span aria-hidden>·</span>
            {submission.wordCount} words
          </div>
          <h1 id="abstract-title" className="mt-2 font-heading text-2xl leading-snug font-semibold md:text-3xl">
            {submission.title}
          </h1>

          {submission.authors.length > 0 ? (
            <div className="mt-3 text-base">
              <p>
                {submission.authors.map((a, i) => (
                  <span key={`${a.surname}-${i}`}>
                    {a.surname} {a.initials}
                    {a.affiliationNos.length ? <sup>{a.affiliationNos.join(",")}</sup> : null}
                    {i < submission.authors.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
              {submission.affiliations.length ? (
                <ol className="mt-1 text-sm text-muted-foreground">
                  {submission.affiliations.map((f) => (
                    <li key={f.number}>
                      <sup>{f.number}</sup> {f.text}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}

          <a href="#scoring" className="mt-4 inline-flex min-h-control items-center gap-1.5 rounded-md text-base font-medium text-brand-ink underline-offset-4 hover:underline lg:hidden">
            <ArrowDown className="size-4" aria-hidden />
            Jump to scoring
          </a>

          <div className="mt-4 space-y-5 rounded-lg border border-border bg-card p-4 md:p-6">
            {sections.map(([key, html]) => (
              <section key={key}>
                <h2 className="text-base font-semibold capitalize">{key.replace(/_/g, " ")}</h2>
                <div className="rich-text text-base" dangerouslySetInnerHTML={{ __html: html || "<p><em>Not provided.</em></p>" }} />
              </section>
            ))}
            {submission.keywords?.length ? (
              <p className="border-t border-border pt-4 text-base">
                <span className="font-semibold">Keywords: </span>
                {submission.keywords.join(", ")}
              </p>
            ) : null}
          </div>

          {data.otherReviews && data.otherReviews.length > 0 ? (
            <section className="mt-6 rounded-lg border border-border bg-card p-4 md:p-6">
              <h2 className="text-lg font-semibold">Other reviewers</h2>
              <ul className="mt-2 space-y-1 text-base">
                {data.otherReviews.map((r, i) => (
                  <li key={i}>
                    Reviewer {i + 1}: {RECOMMENDATIONS.find((x) => x.value === r.recommendation)?.label ?? "No recommendation"}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>

        {/* Form */}
        <aside id="scoring" aria-label="Your review" className="min-w-0 scroll-mt-20 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          {isConflict ? (
            <div className="rounded-lg border border-border bg-card p-5 text-base">
              <p className="flex items-center gap-2 font-semibold">
                <StatusBadge status="conflict" /> You declared a conflict
              </p>
              {data.assignment.coiReason ? <p className="mt-2 text-muted-foreground">Reason: {data.assignment.coiReason}</p> : null}
            </div>
          ) : (
            <div className="space-y-5">
              {submitted ? (
                <p className="flex items-center gap-2 rounded-md bg-success-tint px-3 py-2 text-base text-success-foreground">
                  <CheckCircle2 className="size-5 shrink-0" aria-hidden />
                  Review submitted — thank you. You can still update it.
                </p>
              ) : null}

              <section aria-labelledby="scores-title" className="rounded-lg border border-border bg-card p-4 md:p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="scores-title" className="text-lg font-semibold">Scores</h2>
                  <span className="text-sm text-muted-foreground">
                    {data.rubricCriteria.length - missingCriteria.length} of {data.rubricCriteria.length} scored
                  </span>
                </div>
                {data.rubricCriteria.length === 0 ? (
                  <p className="mt-3 text-base text-muted-foreground">The organisers haven&apos;t set up scoring criteria yet.</p>
                ) : (
                  <ol className="mt-4 space-y-5">
                    {data.rubricCriteria.map((crit) => {
                      const value = scores[crit.id];
                      const missing = showMissing && value === undefined;
                      const opts = Array.from({ length: crit.scaleMax - crit.scaleMin + 1 }, (_, i) => crit.scaleMin + i);
                      const open = !!openDescriptions[crit.id];
                      return (
                        <li key={crit.id} id={`crit-${crit.id}`} className="scroll-mt-24">
                          <div className="flex items-start justify-between gap-2">
                            <p id={`crit-label-${crit.id}`} className="text-base font-semibold">
                              {crit.name}
                              {crit.weight !== 1 ? <span className="ml-2 text-sm font-normal text-muted-foreground">×{crit.weight}</span> : null}
                            </p>
                            {crit.description ? (
                              <button
                                type="button"
                                onClick={() => setOpenDescriptions((p) => ({ ...p, [crit.id]: !open }))}
                                aria-expanded={open}
                                aria-controls={`crit-desc-${crit.id}`}
                                className="-my-2 inline-flex min-h-control shrink-0 items-center gap-1 rounded-md px-2 text-sm text-brand-ink"
                              >
                                <Info className="size-4" aria-hidden />
                                {open ? "Hide guide" : "Guide"}
                              </button>
                            ) : null}
                          </div>
                          {crit.description && open ? (
                            <p id={`crit-desc-${crit.id}`} className="mt-1 rounded-md bg-muted px-3 py-2 text-sm">{crit.description}</p>
                          ) : null}
                          <div
                            role="radiogroup"
                            aria-labelledby={`crit-label-${crit.id}`}
                            className={cn(
                              "mt-2 grid gap-1 rounded-md p-1",
                              missing ? "bg-danger-tint ring-2 ring-danger/40" : "bg-muted",
                            )}
                            style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}
                          >
                            {opts.map((n) => (
                              <button
                                key={n}
                                type="button"
                                role="radio"
                                aria-checked={value === n}
                                disabled={readOnly}
                                onClick={() => setScores((prev) => ({ ...prev, [crit.id]: n }))}
                                className={cn(
                                  "min-h-12 rounded-[5px] text-lg font-semibold tabular-nums transition-colors disabled:cursor-default",
                                  value === n
                                    ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_var(--primary)]"
                                    : "bg-background text-foreground hover:bg-primary-tint",
                                )}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                          <div className="mt-1 flex justify-between text-xs text-muted-foreground" aria-hidden>
                            <span>{crit.scaleMin} = weakest</span>
                            <span>{crit.scaleMax} = strongest</span>
                          </div>
                          {missing ? <p className="mt-1 text-sm font-medium text-danger-foreground">Choose a score.</p> : null}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              <section id="recommendation" aria-labelledby="rec-title" className="scroll-mt-24 rounded-lg border border-border bg-card p-4 md:p-5">
                <h2 id="rec-title" className="text-lg font-semibold">Recommendation</h2>
                <div role="radiogroup" aria-labelledby="rec-title" className={cn("mt-3 grid gap-2", showMissing && !recommendation && "rounded-md ring-2 ring-danger/40")}>
                  {RECOMMENDATIONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      role="radio"
                      aria-checked={recommendation === r.value}
                      disabled={readOnly}
                      onClick={() => setRecommendation(r.value)}
                      className={cn(
                        "flex min-h-control items-start gap-3 rounded-md border p-3 text-left disabled:cursor-default",
                        recommendation === r.value ? "border-primary bg-primary-tint" : "border-border hover:bg-muted/60",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                          recommendation === r.value ? "border-primary" : "border-input",
                        )}
                      >
                        {recommendation === r.value ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                      </span>
                      <span>
                        <span className="block text-base font-medium">{r.label}</span>
                        <span className="block text-sm text-muted-foreground">{r.help}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {showMissing && !recommendation ? <p className="mt-2 text-sm font-medium text-danger-foreground">Choose a recommendation.</p> : null}
              </section>

              <section aria-labelledby="comments-title" className="space-y-5 rounded-lg border border-border bg-card p-4 md:p-5">
                <h2 id="comments-title" className="text-lg font-semibold">Comments</h2>
                <FormField label="For the authors" optional help="Shared with the authors only if the organisers release reviews.">
                  <Textarea value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} rows={3} disabled={readOnly} />
                </FormField>
                <FormField
                  label={<span className="inline-flex items-center gap-1.5"><Lock className="size-4" aria-hidden />For the committee only</span>}
                  optional
                  help="Never shown to authors."
                >
                  <Textarea value={commentCommittee} onChange={(e) => setCommentCommittee(e.target.value)} rows={3} disabled={readOnly} />
                </FormField>
              </section>
              <div className="h-4 lg:hidden" aria-hidden />
            </div>
          )}
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-2 py-2 md:px-4">
          {navigation.prevAssignmentId ? (
            <Button asChild variant="outline" size="icon">
              <Link href={`${portal}/reviews/${navigation.prevAssignmentId}`} aria-label="Previous abstract">
                <ChevronLeft />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon" disabled aria-label="Previous abstract">
              <ChevronLeft />
            </Button>
          )}
          <div className="min-w-0 flex-1 px-1">
            <p className="text-base leading-tight font-semibold tabular-nums">
              {data.rubricCriteria.length ? (
                <>
                  {currentWeightedScore.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground"> / {maxPossibleWeightedScore ? maxPossibleWeightedScore.toFixed(0) : "–"}</span>
                </>
              ) : (
                "—"
              )}
            </p>
            <AutosaveIndicator state={saveState} savedAt={savedAt} onRetry={() => void executeSave(true)} className="min-h-0 text-xs" />
          </div>
          {!readOnly && !isConflict ? (
            <Button onClick={requestSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {submitted ? "Update" : "Submit"}
            </Button>
          ) : null}
          {navigation.nextAssignmentId ? (
            <Button asChild variant="outline" size="icon">
              <Link href={`${portal}/reviews/${navigation.nextAssignmentId}`} aria-label="Next abstract">
                <ChevronRight />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon" disabled aria-label="Next abstract">
              <ChevronRight />
            </Button>
          )}
        </div>
        {showMissing && (missingCriteria.length > 0 || !recommendation) ? (
          <p role="alert" className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-2 text-sm font-medium text-danger-foreground">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {[missingCriteria.length ? `${missingCriteria.length} score${missingCriteria.length === 1 ? "" : "s"}` : null, !recommendation ? "a recommendation" : null]
              .filter(Boolean)
              .join(" and ")}{" "}
            still needed.
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={submitConfirmOpen}
        onOpenChange={setSubmitConfirmOpen}
        title={submitted ? "Update your review?" : "Submit your review?"}
        description={`Score ${currentWeightedScore.toFixed(1)} · ${RECOMMENDATIONS.find((r) => r.value === recommendation)?.label ?? ""}. The track chair sees it straight away.`}
        confirmLabel={submitted ? "Update review" : "Submit review"}
        loading={submitting}
        onConfirm={handleFinalSubmit}
      />

      <ConfirmDialog
        open={conflictModalOpen}
        onOpenChange={setConflictModalOpen}
        title="Declare a conflict of interest?"
        description={
          <span className="grid gap-4 text-left">
            <span>This abstract goes back to the track chair and you won&apos;t be able to review it.</span>
            <FormField label="Reason" required error={conflictError}>
              <Textarea
                value={conflictReason}
                onChange={(e) => {
                  setConflictReason(e.target.value);
                  setConflictError(null);
                }}
                placeholder="e.g. One of the authors is in my unit"
                rows={3}
              />
            </FormField>
          </span>
        }
        confirmLabel="Declare conflict"
        destructive
        loading={declaringConflict}
        onConfirm={handleDeclareConflict}
      />
    </div>
  );
}
