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
} from "lucide-react";
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

                  {accepted ? (
                    <div className="mt-4 flex flex-col gap-3 rounded-md border border-success/30 bg-success-tint p-4 sm:flex-row sm:items-center">
                      <p className="flex-1 text-base text-success-foreground">
                        Congratulations — accepted. Register the presenting author to confirm the slot.
                      </p>
                      <Button asChild>
                        <Link href={`${portal}/register`}>
                          <Ticket data-icon="inline-start" />
                          Register now
                        </Link>
                      </Button>
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
            <StatusBadge status={decisionSub.status} />
            <p className="text-base">{STATUS_COPY[decisionSub.status]}</p>
            {decisionSub.refNo ? (
              <p className="text-sm text-muted-foreground">
                Reference <span className="font-mono font-semibold text-foreground">{decisionSub.refNo}</span>
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Reviewer comments appear here if the organisers choose to share them.
            </p>
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
