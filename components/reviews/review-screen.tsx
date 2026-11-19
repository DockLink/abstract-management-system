"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api/client";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Send,
  Save,
  Loader2,
  EyeOff,
  Eye,
  Info,
  Scale,
  MessageSquare,
  Lock,
} from "lucide-react";
import type {
  ReviewScreenDataDto,
  ReviewRecommendation,
} from "@/components/reviews/types";

interface Props {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
  assignmentId: string;
}

type AutoSaveState = "idle" | "saving" | "saved" | "error";

export function ReviewScreen({
  orgId,
  eventId,
  orgSlug,
  eventSlug,
  assignmentId,
}: Props) {
  const router = useRouter();
  const [data, setData] = useState<ReviewScreenDataDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<ReviewRecommendation | null>(null);
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentCommittee, setCommentCommittee] = useState("");
  const [isDraft, setIsDraft] = useState(true);

  // Status & modal states
  const [saveState, setSaveState] = useState<AutoSaveState>("idle");
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictReason, setConflictReason] = useState("");
  const [declaringConflict, setDeclaringConflict] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  // Load review assignment data
  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<ReviewScreenDataDto>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments/${assignmentId}`,
    );

    if (res.ok) {
      const d = res.data;
      setData(d);

      // Prepopulate form if existing review exists
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
        setSaveState(d.review.isDraft ? "saved" : "saved");
      } else {
        setScores({});
        setRecommendation(null);
        setCommentAuthor("");
        setCommentCommittee("");
        setIsDraft(true);
        setSaveState("idle");
      }
    } else {
      toast.error(res.error.message || "Failed to load review assignment");
      if (res.status === 403) {
        router.push(`/${orgSlug}/${eventSlug}/reviews`);
      }
    }
    setLoading(false);
    // Mark initial load as complete on next tick
    setTimeout(() => {
      initialLoadDone.current = true;
    }, 100);
  }, [orgId, eventId, assignmentId, orgSlug, eventSlug, router]);

  useEffect(() => {
    initialLoadDone.current = false;
    void loadData();
  }, [loadData]);

  // Execute review save (auto-save draft or manual draft)
  const executeSave = useCallback(
    async (asDraft: boolean, customScores?: Record<string, number>) => {
      if (!assignmentId) return false;
      const targetScores = customScores ?? scores;

      setSaveState("saving");

      const scorePayload = Object.entries(targetScores).map(([criterionId, score]) => ({
        criterionId,
        score,
      }));

      const res = await apiFetch(
        `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments/${assignmentId}/save`,
        {
          method: "PUT",
          body: {
            isDraft: asDraft,
            scores: scorePayload,
            recommendation,
            commentAuthor,
            commentCommittee,
          },
        },
      );

      if (res.ok) {
        setSaveState("saved");
        setIsDraft(asDraft);
        return true;
      } else {
        setSaveState("error");
        if (!asDraft) {
          toast.error(res.error.message || "Failed to submit review");
        }
        return false;
      }
    },
    [assignmentId, orgId, eventId, scores, recommendation, commentAuthor, commentCommittee],
  );

  // Debounced auto-save on form state change
  useEffect(() => {
    if (!initialLoadDone.current || !data) return;
    if (data.assignment.status === "COMPLETED" && !isDraft) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaveState("saving");
    debounceTimerRef.current = setTimeout(() => {
      void executeSave(true);
    }, 600);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [scores, recommendation, commentAuthor, commentCommittee, executeSave, data, isDraft]);

  // Live weighted score computation
  const { currentWeightedScore, maxPossibleWeightedScore } = useMemo(() => {
    if (!data || data.rubricCriteria.length === 0) {
      return { currentWeightedScore: 0, maxPossibleWeightedScore: 0 };
    }

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

    const currentScore =
      totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : 0;
    const maxScore =
      totalWeight > 0 ? Math.round((maxWeighted / totalWeight) * 100) / 100 : 0;

    return { currentWeightedScore: currentScore, maxPossibleWeightedScore: maxScore };
  }, [data, scores]);

  // Score button click handler
  const handleScoreSelect = (criterionId: string, val: number) => {
    setScores((prev) => {
      const next = { ...prev, [criterionId]: val };
      return next;
    });
  };

  // Final submission validation and submit
  const handleFinalSubmit = async () => {
    if (!data) return;

    // Validate all criteria scored
    const missingCriteria = data.rubricCriteria.filter(
      (c) => scores[c.id] === undefined,
    );
    if (missingCriteria.length > 0) {
      toast.error(
        `Please score all rubric criteria. Missing: ${missingCriteria.map((m) => m.name).join(", ")}`,
      );
      setSubmitConfirmOpen(false);
      return;
    }

    if (!recommendation) {
      toast.error("Please select a recommendation (Accept oral/poster, Revise, or Reject)");
      setSubmitConfirmOpen(false);
      return;
    }

    setSubmitting(true);
    const success = await executeSave(false);
    setSubmitting(false);

    if (success) {
      toast.success("Review submitted successfully! Thank you.");
      setSubmitConfirmOpen(false);

      // If next assignment exists, prompt or navigate
      if (data.navigation.nextAssignmentId) {
        router.push(
          `/${orgSlug}/${eventSlug}/reviews/${data.navigation.nextAssignmentId}`,
        );
      } else {
        router.push(`/${orgSlug}/${eventSlug}/reviews`);
      }
    }
  };

  // Declare conflict of interest
  const handleDeclareConflict = async () => {
    if (!conflictReason.trim()) {
      toast.error("Please provide a reason for the conflict of interest");
      return;
    }

    setDeclaringConflict(true);
    const res = await apiFetch(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments/${assignmentId}/conflict`,
      {
        method: "POST",
        body: { reason: conflictReason.trim() },
      },
    );
    setDeclaringConflict(false);

    if (res.ok) {
      toast.success("Conflict of interest declared. The abstract has been reassigned.");
      setConflictModalOpen(false);
      router.push(`/${orgSlug}/${eventSlug}/reviews`);
    } else {
      toast.error(res.error.message || "Failed to declare conflict");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading abstract and review form...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold mb-2">Review Not Found</h2>
        <p className="text-muted-foreground mb-4">
          This review assignment could not be loaded or you do not have permission.
        </p>
        <Link href={`/${orgSlug}/${eventSlug}/reviews`}>
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reviews
          </Button>
        </Link>
      </div>
    );
  }

  const { submission, rubricCriteria, navigation, otherReviews } = data;
  const isDoubleBlind = submission.blindMode === "DOUBLE";
  const isCompleted = data.assignment.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* ─── Sticky Header Bar ─── */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b px-4 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link href={`/${orgSlug}/${eventSlug}/reviews`}>
            <Button variant="ghost" size="sm" className="gap-1.5 h-8">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">My Reviews</span>
            </Button>
          </Link>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Abstract {navigation.currentIndex} of {navigation.totalAssignments}
          </span>
          <span className="font-mono text-xs px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
            {submission.refNo || "Draft"}
          </span>
        </div>

        {/* Auto-save & Status indicator */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs">
            {saveState === "saving" && (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Auto-saving...
              </span>
            )}
            {saveState === "saved" && (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isCompleted ? "Review submitted" : "Changes saved"}
              </span>
            )}
            {saveState === "error" && (
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Save error
              </span>
            )}
          </div>

          {/* Navigation Between Abstracts */}
          <div className="flex items-center gap-1 border-l pl-3 border-slate-200 dark:border-slate-800">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!navigation.prevAssignmentId}
              onClick={() => {
                if (navigation.prevAssignmentId) {
                  router.push(
                    `/${orgSlug}/${eventSlug}/reviews/${navigation.prevAssignmentId}`,
                  );
                }
              }}
              title="Previous Abstract"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!navigation.nextAssignmentId}
              onClick={() => {
                if (navigation.nextAssignmentId) {
                  router.push(
                    `/${orgSlug}/${eventSlug}/reviews/${navigation.nextAssignmentId}`,
                  );
                }
              }}
              title="Next Abstract"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* COI button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConflictModalOpen(true)}
            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-8"
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Declare Conflict</span>
          </Button>
        </div>
      </header>

      {/* ─── Main Two-Column Split Screen (Stacked on Mobile) ─── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* ─── Left Column: Abstract View (7 cols on desktop) ─── */}
        <section className="lg:col-span-7 border-r bg-white dark:bg-slate-900 overflow-y-auto p-6 md:p-8 space-y-6 max-h-[calc(100vh-53px)]">
          {/* Blind Mode Notice Banner (REV-03) */}
          <div
            className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs leading-relaxed ${
              isDoubleBlind
                ? "bg-indigo-50/70 border-indigo-200 text-indigo-900 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-200"
                : "bg-blue-50/70 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200"
            }`}
          >
            {isDoubleBlind ? (
              <EyeOff className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
            ) : (
              <Eye className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            )}
            <div>
              <span className="font-semibold block mb-0.5">
                {isDoubleBlind ? "Double-Blind Review Active" : "Single-Blind Review Active"}
              </span>
              {isDoubleBlind
                ? "Author names, emails, institutions, and affiliations have been automatically anonymized to ensure unbiased peer review."
                : "Your identity as a reviewer is confidential and will not be disclosed to the authors."}
            </div>
          </div>

          {/* Abstract Title & Metadata */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {submission.category && (
                <Badge variant="secondary" className="font-normal text-xs">
                  {submission.category.name}
                </Badge>
              )}
              {submission.preferredPresentationType && (
                <Badge variant="outline" className="text-xs uppercase tracking-wider">
                  Prefers: {submission.preferredPresentationType}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {submission.wordCount} words
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-snug">
              {submission.title}
            </h1>
          </div>

          {/* Authors (only shown in Single-Blind mode, never Double-Blind per REV-03) */}
          {!isDoubleBlind && submission.authors && submission.authors.length > 0 && (
            <div className="border-y py-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide text-[10px]">
                Authors
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                {submission.authors.map((author, idx) => (
                  <span key={idx}>
                    {author.initials} {author.surname}
                    {author.affiliationNos?.length > 0 && (
                      <sup>{author.affiliationNos.join(",")}</sup>
                    )}
                    {author.isPresenting && " (Presenter)"}
                    {idx < submission.authors.length - 1 && "; "}
                  </span>
                ))}
              </div>
              {submission.affiliations && submission.affiliations.length > 0 && (
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                  {submission.affiliations.map((aff) => (
                    <div key={aff.number}>
                      <sup>{aff.number}</sup> {aff.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Structured Abstract Body Sections */}
          <div className="space-y-6 pt-2">
            {submission.abstractBody &&
            Object.keys(submission.abstractBody).length > 0 ? (
              Object.entries(submission.abstractBody).map(([sectionKey, htmlContent]) => (
                <div key={sectionKey} className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    {sectionKey.replace(/_/g, " ")}
                  </h3>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No structured abstract sections provided.
              </p>
            )}
          </div>

          {/* Keywords */}
          {submission.keywords && submission.keywords.length > 0 && (
            <div className="border-t pt-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Keywords
              </div>
              <div className="flex flex-wrap gap-1.5">
                {submission.keywords.map((kw, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs font-normal bg-slate-50 dark:bg-slate-800/60"
                  >
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ─── Right Column: Review Form & Scoring (5 cols on desktop) ─── */}
        <section className="lg:col-span-5 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6 space-y-6 max-h-[calc(100vh-53px)]">
          {/* Weighted Live Score Card */}
          <Card className="border shadow-xs bg-white dark:bg-slate-900">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  Score Evaluation
                </CardTitle>
                <Badge variant={isCompleted ? "default" : "outline"} className="text-xs">
                  {isCompleted ? "Submitted" : "Draft"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                    {currentWeightedScore}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    / {maxPossibleWeightedScore || 5}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {Object.keys(scores).length} of {rubricCriteria.length} criteria evaluated
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scoring Rubric Criteria */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>Rubric Criteria</span>
              <span className="text-[10px] lowercase font-normal">(auto-saves)</span>
            </h2>

            {rubricCriteria.map((criterion) => {
              const currentScore = scores[criterion.id];
              const scaleValues = [];
              for (let i = criterion.scaleMin; i <= criterion.scaleMax; i++) {
                scaleValues.push(i);
              }

              return (
                <div
                  key={criterion.id}
                  className="p-4 rounded-xl border bg-white dark:bg-slate-900 shadow-2xs space-y-3 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {criterion.name}
                      </h4>
                      {criterion.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {criterion.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0 font-normal">
                      Weight: {criterion.weight}x
                    </Badge>
                  </div>

                  {/* Scale Rating Selector Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {scaleValues.map((val) => {
                      const isSelected = currentScore === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleScoreSelect(criterion.id, val)}
                          className={`flex-1 min-w-[36px] py-2 px-3 text-sm font-semibold rounded-lg border transition-all text-center ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs scale-102"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendation Selector (REV-05) */}
          <div className="space-y-2.5 pt-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recommendation <span className="text-rose-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRecommendation("ACCEPT_ORAL")}
                className={`p-3 rounded-xl border text-left font-medium text-xs transition-all flex flex-col gap-1 ${
                  recommendation === "ACCEPT_ORAL"
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span className="font-bold text-sm">Accept Oral</span>
                <span className="opacity-80 text-[11px]">Recommended for oral platform</span>
              </button>

              <button
                type="button"
                onClick={() => setRecommendation("ACCEPT_POSTER")}
                className={`p-3 rounded-xl border text-left font-medium text-xs transition-all flex flex-col gap-1 ${
                  recommendation === "ACCEPT_POSTER"
                    ? "bg-sky-500 text-white border-sky-600 shadow-sm"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span className="font-bold text-sm">Accept Poster</span>
                <span className="opacity-80 text-[11px]">Recommended for poster display</span>
              </button>

              <button
                type="button"
                onClick={() => setRecommendation("REVISE")}
                className={`p-3 rounded-xl border text-left font-medium text-xs transition-all flex flex-col gap-1 ${
                  recommendation === "REVISE"
                    ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span className="font-bold text-sm">Revisions Required</span>
                <span className="opacity-80 text-[11px]">Author must revise and resubmit</span>
              </button>

              <button
                type="button"
                onClick={() => setRecommendation("REJECT")}
                className={`p-3 rounded-xl border text-left font-medium text-xs transition-all flex flex-col gap-1 ${
                  recommendation === "REJECT"
                    ? "bg-rose-500 text-white border-rose-600 shadow-sm"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span className="font-bold text-sm">Reject</span>
                <span className="opacity-80 text-[11px]">Not suitable for session</span>
              </button>
            </div>
          </div>

          {/* Comments to Authors */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Comments to Author
            </Label>
            <Textarea
              placeholder="Constructive feedback, comments, and rationale to share with the author..."
              value={commentAuthor}
              onChange={(e) => setCommentAuthor(e.target.value)}
              rows={4}
              className="bg-white dark:bg-slate-900 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              These comments will be included in the decision letter if the committee releases feedback.
            </p>
          </div>

          {/* Confidential Comments to Committee */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-amber-500" />
              Confidential Comments to Committee
            </Label>
            <Textarea
              placeholder="Confidential remarks seen strictly by academic chairs and event admins..."
              value={commentCommittee}
              onChange={(e) => setCommentCommittee(e.target.value)}
              rows={3}
              className="bg-white dark:bg-slate-900 text-sm"
            />
          </div>

          {/* Other Reviewers' Scores (REV-12) */}
          {otherReviews && otherReviews.length > 0 && (
            <div className="p-4 rounded-xl border bg-slate-100/60 dark:bg-slate-900/60 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-blue-500" />
                Other Reviewers&apos; Evaluations
              </div>
              <div className="space-y-2 text-xs">
                {otherReviews.map((r, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border flex justify-between items-center"
                  >
                    <span className="font-medium">Reviewer {i + 1}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.recommendation?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions & Final Submit */}
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => void executeSave(true)}
                disabled={saveState === "saving"}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground font-semibold"
                onClick={() => setSubmitConfirmOpen(true)}
              >
                <Send className="h-4 w-4 mr-2" />
                {isCompleted ? "Update Review" : "Submit Review"}
              </Button>
            </div>
            <p className="text-[11px] text-center text-muted-foreground">
              Every change auto-saves continuously. Once submitted, your score enters the ranking table.
            </p>
          </div>
        </section>
      </div>

      {/* ─── Submit Final Confirmation Dialog ─── */}
      <Dialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Review Submission</DialogTitle>
            <DialogDescription>
              You are submitting a score of{" "}
              <strong>
                {currentWeightedScore} / {maxPossibleWeightedScore}
              </strong>{" "}
              with the recommendation <strong>{recommendation?.replace(/_/g, " ")}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-600 dark:text-slate-400">
            Are you ready to submit this evaluation to the conference committee? You can still edit
            your score prior to the review deadline.
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setSubmitConfirmOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleFinalSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Conflict of Interest Dialog (REV-07) ─── */}
      <Dialog open={conflictModalOpen} onOpenChange={setConflictModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              Declare Conflict of Interest
            </DialogTitle>
            <DialogDescription>
              Declaring a conflict of interest will return this abstract to the chair for
              reassignment. Please state your reason (e.g., recent co-author, institutional colleague,
              or financial relationship).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="coi-reason">Reason for Conflict of Interest</Label>
            <Textarea
              id="coi-reason"
              placeholder="Explain the conflict of interest (e.g. Co-investigator on this grant)..."
              value={conflictReason}
              onChange={(e) => setConflictReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConflictModalOpen(false)}
              disabled={declaringConflict}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeclareConflict}
              disabled={declaringConflict}
            >
              {declaringConflict && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Conflict Declaration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

