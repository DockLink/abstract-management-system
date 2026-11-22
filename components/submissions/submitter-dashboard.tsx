"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  FileText,
  Gavel,
  History,
  Loader2,
  Pencil,
  Plus,
  Ticket,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeadlineCountdown } from "@/components/shared/deadline-countdown";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { CardListSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { formatLongDate, formatLongDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { SubmissionDto, SubmissionVersionDto } from "@/lib/types/api";

/** What each status means for the author, in plain words. */
const STATUS_COPY: Record<string, string> = {
  DRAFT: "Saved as a draft. Reviewers can't see it until you submit.",
  SUBMITTED: "Submitted. Waiting to be assigned to reviewers.",
  UNDER_REVIEW: "Being reviewed. Reviewers don't see author names.",
  REVISIONS_REQUESTED: "The committee asked for changes. Edit and submit again.",
  ACCEPTED: "Accepted for presentation. The presenting author must register to confirm the slot.",
  CONFIRMED: "Registration confirmed. This abstract is in the programme.",
  REJECTED: "Not accepted for presentation at this meeting.",
  WAITLISTED: "On the waiting list. You'll hear if a slot opens.",
  WITHDRAWN: "Withdrawn by the author. It won't be reviewed.",
};

const DECIDED = new Set(["ACCEPTED", "CONFIRMED", "REJECTED", "WAITLISTED"]);

export function SubmitterDashboard({
  orgId,
  eventId,
  orgSlug,
  eventSlug,
  deadline = null,
  canSubmit = true,
}: {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
  /** Submission deadline (ISO), for the countdown on drafts. */
  deadline?: string | null;
  canSubmit?: boolean;
}) {
  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [withdrawTarget, setWithdrawTarget] = useState<SubmissionDto | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const [versionSub, setVersionSub] = useState<SubmissionDto | null>(null);
  const [versions, setVersions] = useState<SubmissionVersionDto[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const [decisionSub, setDecisionSub] = useState<SubmissionDto | null>(null);

  const [declineTarget, setDeclineTarget] = useState<SubmissionDto | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [respondingSlot, setRespondingSlot] = useState(false);

  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;
  const portal = `/${orgSlug}/${eventSlug}`;

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: SubmissionDto[] }>(`${base}/submissions`);
      if (res.ok) {
        setSubmissions(res.data.data);
        setLoadError(null);
      } else {
        setLoadError(res.error.message || "Your abstracts couldn't be loaded.");
      }
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  async function viewVersions(sub: SubmissionDto) {
    setVersionSub(sub);
    setVersionsLoading(true);
    try {
      const res = await apiFetch<SubmissionVersionDto[]>(`${base}/submissions/${sub.id}/versions`);
      if (res.ok) setVersions(res.data);
      else toast.error("Couldn't load the history", { description: res.error.message });
    } finally {
      setVersionsLoading(false);
    }
  }

  async function confirmWithdraw() {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const res = await apiFetch(`${base}/submissions/${withdrawTarget.id}/actions`, {
        method: "POST",
        body: { action: "withdraw" },
      });
      if (res.ok) {
        toast.success("Abstract withdrawn");
        setWithdrawTarget(null);
        await loadSubmissions();
      } else {
        toast.error("Couldn't withdraw the abstract", { description: res.error.message });
      }
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleConfirmSlot(sub: SubmissionDto) {
    setRespondingSlot(true);
    try {
      const res = await apiFetch(`${base}/submissions/${sub.id}/slot`, {
        method: "POST",
        body: { response: "CONFIRMED" },
      });
      if (res.ok) {
        toast.success("Presentation slot confirmed");
        await loadSubmissions();
      } else {
        toast.error("Couldn't confirm the slot", { description: res.error.message });
      }
    } finally {
      setRespondingSlot(false);
    }
  }

  async function handleDeclineSlot() {
    if (!declineTarget) return;
    setRespondingSlot(true);
    try {
      const res = await apiFetch(`${base}/submissions/${declineTarget.id}/slot`, {
        method: "POST",
        body: { response: "DECLINED", reason: declineReason.trim() || undefined },
      });
      if (res.ok) {
        toast.success("Presentation slot declined");
        setDeclineTarget(null);
        setDeclineReason("");
        await loadSubmissions();
      } else {
        toast.error("Couldn't decline the slot", { description: res.error.message });
      }
    } finally {
      setRespondingSlot(false);
    }
  }

  const deadlineOpen = !!deadline && canSubmit;

  return (
    <div className="mx-auto max-w-3xl px-gutter py-6 md:py-8">
      <PageHeader
        title="My submissions"
        description="Track each abstract, finish drafts and see decisions."
        actions={
          canSubmit ? (
            <Button asChild>
              <Link href={`${portal}/submit`}>
                <Plus data-icon="inline-start" />
                New abstract
              </Link>
            </Button>
          ) : undefined
        }
      />

      {deadlineOpen ? <DeadlineCountdown label="Submissions close" deadline={deadline!} className="mb-6" /> : null}

      {loading ? (
        <CardListSkeleton count={2} label="Loading your abstracts…" />
      ) : loadError ? (
        <ErrorState title="Your abstracts didn't load" description={loadError} onRetry={() => void loadSubmissions()} />
      ) : submissions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No abstracts yet"
          description={
            canSubmit
              ? "Start one now — it's saved as a draft as you go, so you can finish later."
              : "Submissions aren't open at the moment."
          }
          action={
            canSubmit ? (
              <Button asChild>
                <Link href={`${portal}/submit`}>
                  <Plus data-icon="inline-start" />
                  Start an abstract
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={portal}>See key dates</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-4">
          {submissions.map((sub) => {
            const editable = ["DRAFT", "REVISIONS_REQUESTED"].includes(sub.status);
            const canWithdraw = ["DRAFT", "SUBMITTED"].includes(sub.status);
            const accepted = sub.status === "ACCEPTED";
            const decided = DECIDED.has(sub.status);
            const presenter = sub.authors?.find((a) => a.isPresenting);

            return (
              <li key={sub.id} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={sub.status} />
                    {sub.refNo ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-semibold">{sub.refNo}</span>
                    ) : null}
                    <span className="ml-auto text-sm text-muted-foreground">Updated {formatLongDate(sub.updatedAt)}</span>
                  </div>
                  <h2 className="mt-3 text-lg leading-snug font-semibold [overflow-wrap:anywhere]">
                    {sub.title || "Untitled abstract"}
                  </h2>
                  <p className="mt-1 text-base text-muted-foreground">{STATUS_COPY[sub.status] ?? ""}</p>
                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    {presenter ? (
                      <div className="flex gap-1">
                        <dt className="text-muted-foreground">Presenter</dt>
                        <dd className="font-medium">{presenter.surname} {presenter.initials}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Words</dt>
                      <dd className="font-medium tabular-nums">{sub.wordCount}</dd>
                    </div>
                    {sub.preferredPresentationType ? (
                      <div className="flex gap-1">
                        <dt className="text-muted-foreground">Prefers</dt>
                        <dd className="font-medium capitalize">{sub.preferredPresentationType}</dd>
                      </div>
                    ) : null}
                  </dl>

                  {sub.status === "DRAFT" && deadlineOpen ? (
                    <p className="mt-3 rounded-md bg-warning-tint px-3 py-2 text-sm text-warning-foreground">
                      Not submitted yet. Submit before {formatLongDateTime(deadline)}.
                    </p>
                  ) : null}

                  {sub.status === "REVISIONS_REQUESTED" ? (
                    <div className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200">
                      <p className="font-semibold">Revisions requested by the committee.</p>
                      {sub.revisionDueAt ? (
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                          Please submit your revised abstract before {formatLongDate(sub.revisionDueAt)}.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {accepted ? (
                    <div className="mt-4 flex flex-col gap-3 rounded-md border border-success/30 bg-success-tint p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-success-foreground">
                            Congratulations — accepted for {sub.presentationType ? `${sub.presentationType.toLowerCase()} presentation` : "presentation"}.
                          </p>
                          {sub.slotResponse === "CONFIRMED" ? (
                            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                              ✓ Presentation slot confirmed. Please complete registration before the deadline.
                            </p>
                          ) : sub.slotResponse === "DECLINED" ? (
                            <p className="text-sm text-red-600 dark:text-red-400 font-medium mt-1">
                              Slot declined.
                            </p>
                          ) : (
                            <p className="text-sm text-success-foreground/80 mt-1">
                              Please confirm whether you will present at the symposium, then register.
                            </p>
                          )}
                        </div>
                        {sub.slotResponse === "CONFIRMED" ? (
                          <Button asChild size="sm">
                            <Link href={`${portal}/register`}>
                              <Ticket data-icon="inline-start" />
                              Register now
                            </Link>
                          </Button>
                        ) : !sub.slotResponse ? (
                          <div className="flex items-center gap-2 mt-2 sm:mt-0">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={respondingSlot}
                              onClick={() => void handleConfirmSlot(sub)}
                            >
                              Confirm slot
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                              disabled={respondingSlot}
                              onClick={() => {
                                setDeclineTarget(sub);
                                setDeclineReason("");
                              }}
                            >
                              Decline slot
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface/60 px-3 py-2">
                  {editable ? (
                    <Button asChild size="sm">
                      <Link href={`${portal}/submit?id=${sub.id}`}>
                        <Pencil data-icon="inline-start" />
                        {sub.status === "REVISIONS_REQUESTED" ? "Edit revisions" : "Continue draft"}
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`${portal}/submit?id=${sub.id}`}>View abstract</Link>
                    </Button>
                  )}
                  {decided ? (
                    <Button size="sm" variant="outline" onClick={() => setDecisionSub(sub)}>
                      <Gavel data-icon="inline-start" />
                      View decision
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => void viewVersions(sub)}>
                    <History data-icon="inline-start" />
                    History
                  </Button>
                  {canWithdraw ? (
                    <Button size="sm" variant="ghost" className="ml-auto text-danger-foreground" onClick={() => setWithdrawTarget(sub)}>
                      Withdraw…
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SidePanel
        open={!!decisionSub}
        onOpenChange={(o) => !o && setDecisionSub(null)}
        title="Decision"
        description={decisionSub?.title}
        footer={<Button variant="outline" onClick={() => setDecisionSub(null)}>Close</Button>}
      >
        {decisionSub ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={decisionSub.status} />
              {decisionSub.presentationType && (
                <span className="font-semibold text-xs px-2 py-0.5 rounded bg-muted">
                  {decisionSub.presentationType} Presentation
                </span>
              )}
            </div>
            <p className="text-base">{STATUS_COPY[decisionSub.status]}</p>
            {decisionSub.refNo ? (
              <p className="text-sm text-muted-foreground">
                Reference <span className="font-mono font-semibold text-foreground">{decisionSub.refNo}</span>
              </p>
            ) : null}

            {decisionSub.decisionNote && (
              <div className="bg-muted/30 p-3 rounded text-sm text-foreground">
                <span className="text-xs font-semibold text-muted-foreground block mb-1">Committee Note:</span>
                {decisionSub.decisionNote}
              </div>
            )}

            {decisionSub.reviewsReleased && decisionSub.reviewerComments && decisionSub.reviewerComments.length > 0 ? (
              <div className="space-y-2 pt-2 border-t">
                <h3 className="text-sm font-semibold">Reviewer Comments</h3>
                {decisionSub.reviewerComments.map((cmt, idx) => (
                  <div key={idx} className="bg-muted/40 p-3 rounded text-sm text-foreground">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Reviewer {idx + 1}</div>
                    <p className="whitespace-pre-line">{cmt}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Reviewer comments appear here if the organisers choose to share them.
              </p>
            )}

            {decisionSub.status === "ACCEPTED" ? (
              <Button asChild className="w-full sm:w-auto">
                <Link href={`${portal}/register`}>
                  Register now
                  <ChevronRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </SidePanel>

      <Dialog open={!!declineTarget} onOpenChange={(o) => !o && setDeclineTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Presentation Slot?</DialogTitle>
            <DialogDescription>
              Are you sure you want to decline the presentation slot for “{declineTarget?.title}”? This will withdraw your abstract and allow the slot to be offered to a waitlisted author.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="declineReason">Reason (Optional)</Label>
            <Input
              id="declineReason"
              placeholder="e.g. Schedule conflict, unable to travel"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeclineSlot()}
              disabled={respondingSlot}
            >
              {respondingSlot ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SidePanel
        open={!!versionSub}
        onOpenChange={(o) => !o && setVersionSub(null)}
        title="History"
        description="A copy is kept every time the abstract is saved or its status changes."
        footer={<Button variant="outline" onClick={() => setVersionSub(null)}>Close</Button>}
      >
        {versionsLoading ? (
          <p className="flex items-center gap-2 text-base text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading history…
          </p>
        ) : versions.length === 0 ? (
          <p className="text-base text-muted-foreground">No earlier versions yet.</p>
        ) : (
          <ol className="space-y-2">
            {versions.map((ver) => (
              <li key={ver.id} className={cn("flex items-center justify-between rounded-md border border-border px-4 py-3")}>
                <span className="text-base font-medium">Version {ver.version}</span>
                <span className="text-sm text-muted-foreground">{formatLongDateTime(ver.createdAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </SidePanel>

      <ConfirmDialog
        open={!!withdrawTarget}
        onOpenChange={(o) => !o && setWithdrawTarget(null)}
        title="Withdraw this abstract?"
        description={`“${withdrawTarget?.title ?? ""}” won't be reviewed. You can't undo this — you'd need to submit it again as a new abstract.`}
        confirmLabel="Withdraw abstract"
        destructive
        loading={withdrawing}
        onConfirm={confirmWithdraw}
      />
    </div>
  );
}
