"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Award, ChevronRight, ClipboardList, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeadlineCountdown } from "@/components/shared/deadline-countdown";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { CardListSkeleton } from "@/components/shared/skeletons";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { ReviewerDashboardDataDto } from "@/components/reviews/types";
import { ReviewerCertificateModal } from "./reviewer-certificate-modal";

type Filter = "TODO" | "COMPLETED" | "ALL";

const RECOMMENDATION_LABEL: Record<string, string> = {
  ACCEPT_ORAL: "Accept · oral",
  ACCEPT_POSTER: "Accept · poster",
  REVISE: "Revise",
  REJECT: "Reject",
};

interface Props {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
}

/** Reviewer home (REV-09): counts, deadline, then the abstracts to review. */
export function ReviewerDashboard({ orgId, eventId, orgSlug, eventSlug }: Props) {
  const [data, setData] = useState<ReviewerDashboardDataDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [agreeChecked, setAgreeChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [filter, setFilter] = useState<Filter>("TODO");
  const [certModalOpen, setCertModalOpen] = useState(false);

  const [coiTarget, setCoiTarget] = useState<{ id: string; title: string } | null>(null);
  const [coiReason, setCoiReason] = useState("");
  const [coiError, setCoiError] = useState<string | null>(null);
  const [declaringCoi, setDeclaringCoi] = useState(false);

  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;
  const portal = `/${orgSlug}/${eventSlug}`;

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<ReviewerDashboardDataDto>(`${base}/reviews/my-dashboard`);
    if (res.ok) {
      setData(res.data);
      setLoadError(null);
    } else {
      setLoadError({ status: res.status, message: res.error.message || "The reviewer portal couldn't be loaded." });
    }
    const meRes = await apiFetch<{ id: string; fullName: string | null }>(`${base}/reviewers/me`);
    if (meRes.ok) setCurrentUserId(meRes.data.id);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // REV-02. The endpoint is POST /reviewers/me (the old UI posted to a path that doesn't exist).
  const handleAcceptConfidentiality = async () => {
    if (!agreeChecked) return;
    setAccepting(true);
    const res = await apiFetch(`${base}/reviewers/me`, {
      method: "POST",
      body: { agreeToConfidentiality: true },
    });
    setAccepting(false);
    if (res.ok) {
      toast.success("Agreement accepted", "Your abstracts are ready to review.");
      void loadDashboard();
    } else {
      toast.error("Couldn't record your agreement", { description: res.error.message });
    }
  };

  // REV-07
  const handleDeclareCoi = async () => {
    if (!coiTarget) return;
    if (!coiReason.trim()) {
      setCoiError("Say briefly why — for example, “I supervised this work”.");
      return;
    }
    setDeclaringCoi(true);
    const res = await apiFetch(`${base}/reviews/assignments/${coiTarget.id}/conflict`, {
      method: "POST",
      body: { reason: coiReason.trim() },
    });
    setDeclaringCoi(false);
    if (res.ok) {
      toast.success("Conflict declared", "The track chair will reassign this abstract.");
      setCoiTarget(null);
      setCoiReason("");
      void loadDashboard();
    } else {
      toast.error("Couldn't declare the conflict", { description: res.error.message });
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-3xl px-gutter py-6 md:py-8">
        <CardListSkeleton count={3} label="Loading your reviews…" />
      </div>
    );
  }

  if (loadError || !data) {
    const notReviewer = loadError?.status === 403;
    return (
      <div className="mx-auto max-w-3xl px-gutter py-6 md:py-8">
        <ErrorState
          title={notReviewer ? "You're not a reviewer for this event" : "Your reviews didn't load"}
          description={
            notReviewer
              ? "If you were invited, check you're signed in with the email the invitation went to."
              : loadError?.message
          }
          onRetry={notReviewer ? undefined : () => void loadDashboard()}
          action={
            <Button asChild variant="outline">
              <Link href={portal}>Back to the event</Link>
            </Button>
          }
        />
      </div>
    );
  }

  /* REV-02: confidentiality before any abstract */
  if (!data.hasAgreedToConfidentiality) {
    return (
      <div className="mx-auto max-w-2xl px-gutter py-6 md:py-10">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-tint text-brand-ink">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <h1 className="font-heading text-3xl font-semibold">Before you start reviewing</h1>
        <p className="mt-2 text-lg text-muted-foreground">You&apos;ll see unpublished work. Please agree to keep it confidential.</p>
        <ul className="mt-6 space-y-4 text-base">
          <li className="rounded-lg border border-border bg-card p-4">
            <p className="font-semibold">Keep it confidential</p>
            <p className="mt-1 text-muted-foreground">Don&apos;t share, copy or discuss abstracts with anyone, or paste them into AI tools.</p>
          </li>
          <li className="rounded-lg border border-border bg-card p-4">
            <p className="font-semibold">Declare conflicts of interest</p>
            <p className="mt-1 text-muted-foreground">If you recognise work by a close colleague or your own unit, use “Conflict of interest” on that abstract.</p>
          </li>
          <li className="rounded-lg border border-border bg-card p-4">
            <p className="font-semibold">Score fairly</p>
            <p className="mt-1 text-muted-foreground">Use the rubric, and keep comments constructive.</p>
          </li>
        </ul>
        <Label className="mt-6 flex items-start gap-3 rounded-lg border border-border p-4 text-base font-normal has-[[data-state=checked]]:border-primary">
          <Checkbox checked={agreeChecked} onCheckedChange={(v) => setAgreeChecked(v === true)} className="mt-0.5" />
          I agree to these terms for this event.
        </Label>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="ghost">
            <Link href={portal}>Not now</Link>
          </Button>
          <Button size="lg" disabled={!agreeChecked || accepting} onClick={() => void handleAcceptConfidentiality()}>
            {accepting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Agree and start reviewing
          </Button>
        </div>
      </div>
    );
  }

  const { stats } = data;
  const todo = data.assignments.filter((a) => a.status === "PENDING" || a.status === "IN_PROGRESS");
  const visible =
    filter === "TODO" ? todo : filter === "COMPLETED" ? data.assignments.filter((a) => a.status === "COMPLETED") : data.assignments;
  const next = data.assignments.find((a) => a.status === "IN_PROGRESS") ?? data.assignments.find((a) => a.status === "PENDING");
  const total = stats.totalAssigned - stats.conflict;
  const pct = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-gutter py-6 md:py-8">
      <PageHeader
        title="Your reviews"
        description={total ? `${stats.completed} of ${total} done` : "Nothing assigned yet"}
        actions={
          stats.completed > 0 && currentUserId ? (
            <Button variant="outline" onClick={() => setCertModalOpen(true)}>
              <Award data-icon="inline-start" />
              Certificate
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="To start" value={stats.pending} className="p-3 md:p-4" />
        <StatCard label="In progress" value={stats.inProgress} className="p-3 md:p-4" />
        <StatCard label="Done" value={stats.completed} progress={total ? pct : undefined} className="p-3 md:p-4" />
      </div>

      {data.deadline.reviewDeadlineAt ? (
        <DeadlineCountdown label="Reviews due" deadline={data.deadline.reviewDeadlineAt} className="mt-4" />
      ) : null}

      {next ? (
        <Button asChild size="lg" className="mt-4 w-full">
          <Link href={`${portal}/reviews/${next.assignmentId}`}>
            {next.status === "IN_PROGRESS" ? "Continue where you left off" : "Start next review"}
            <ChevronRight data-icon="inline-end" />
          </Link>
        </Button>
      ) : null}

      <div role="tablist" aria-label="Show" className="mt-8 grid grid-cols-3 rounded-md bg-muted p-1">
        {([
          ["TODO", `To do (${todo.length})`],
          ["COMPLETED", `Done (${stats.completed})`],
          ["ALL", `All (${data.assignments.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "min-h-control rounded-[5px] text-sm font-medium",
              filter === key ? "bg-background text-foreground shadow-[0_0_0_1px_var(--border)]" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {data.assignments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No abstracts assigned yet"
            description="The track chair assigns abstracts after submissions close. You'll find them here."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            title={filter === "TODO" ? "All done — thank you" : "Nothing here yet"}
            description={filter === "TODO" ? "Every abstract assigned to you has a submitted review." : undefined}
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((a) => {
              const done = a.status === "COMPLETED";
              const conflict = a.status === "CONFLICT";
              return (
                <li key={a.assignmentId} className={cn("rounded-lg border border-border bg-card", conflict && "opacity-75")}>
                  <Link
                    href={conflict ? "#" : `${portal}/reviews/${a.assignmentId}`}
                    aria-disabled={conflict || undefined}
                    onClick={(e) => conflict && e.preventDefault()}
                    className="block p-4 hover:bg-muted/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={a.status} size="sm" />
                      {a.refNo ? <span className="font-mono text-sm text-muted-foreground">{a.refNo}</span> : null}
                      {done && a.review?.weightedScore != null ? (
                        <span className="ml-auto text-sm font-semibold tabular-nums">Score {a.review.weightedScore}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-base leading-snug font-semibold [overflow-wrap:anywhere]">{a.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[a.category?.name, a.submissionType?.name].filter(Boolean).join(" · ")}
                      {done && a.review?.recommendation ? ` · ${RECOMMENDATION_LABEL[a.review.recommendation] ?? a.review.recommendation}` : ""}
                    </p>
                    {conflict && a.coiReason ? <p className="mt-2 text-sm text-muted-foreground">Conflict declared: {a.coiReason}</p> : null}
                  </Link>
                  {!conflict ? (
                    <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
                      {!done ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-foreground"
                          onClick={() => {
                            setCoiTarget({ id: a.assignmentId, title: a.title });
                            setCoiReason("");
                            setCoiError(null);
                          }}
                        >
                          <ShieldAlert data-icon="inline-start" />
                          Conflict of interest
                        </Button>
                      ) : (
                        <span />
                      )}
                      <Button asChild size="sm" variant={done ? "outline" : "default"}>
                        <Link href={`${portal}/reviews/${a.assignmentId}`}>
                          {done ? "View" : a.status === "IN_PROGRESS" ? "Continue" : "Start"}
                          <span className="sr-only"> review of {a.refNo ?? a.title}</span>
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!coiTarget}
        onOpenChange={(o) => !o && setCoiTarget(null)}
        title="Declare a conflict of interest?"
        description={
          <span className="grid gap-4 text-left">
            <span>
              “{coiTarget?.title}” goes back to the track chair and you won&apos;t be able to review it.
            </span>
            <FormField label="Reason" required error={coiError}>
              <Textarea
                value={coiReason}
                onChange={(e) => {
                  setCoiReason(e.target.value);
                  setCoiError(null);
                }}
                placeholder="e.g. One of the authors is in my unit"
                rows={3}
              />
            </FormField>
          </span>
        }
        confirmLabel="Declare conflict"
        destructive
        loading={declaringCoi}
        onConfirm={handleDeclareCoi}
      />

      {currentUserId ? (
        <ReviewerCertificateModal
          orgId={orgId}
          eventId={eventId}
          reviewerId={currentUserId}
          reviewerName={null}
          open={certModalOpen}
          onOpenChange={setCertModalOpen}
        />
      ) : null}
    </div>
  );
}
