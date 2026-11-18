"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Eye,
} from "lucide-react";
import type { SubmissionDto, SubmissionVersionDto } from "@/lib/types/api";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; desc: string }
> = {
  DRAFT: {
    label: "Draft",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    desc: "Saved locally. Not visible to reviewers until submitted.",
  },
  SUBMITTED: {
    label: "Submitted",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    desc: "Abstract submitted. Awaiting review assignment.",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    desc: "Currently undergoing blinded peer review.",
  },
  REVISIONS_REQUESTED: {
    label: "Revisions Requested",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    desc: "The reviewers have requested revisions. Please edit and re-submit.",
  },
  ACCEPTED: {
    label: "Accepted",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    desc: "Congratulations! Your abstract has been accepted for presentation.",
  },
  CONFIRMED: {
    label: "Confirmed",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    desc: "Registration confirmed. Abstract included in conference programme.",
  },
  REJECTED: {
    label: "Not Accepted",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    desc: "Not selected for presentation at this session.",
  },
  WAITLISTED: {
    label: "Waitlisted",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    desc: "Placed on waitlist. You will be notified if a slot opens.",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    color: "bg-gray-100 text-gray-500 border-gray-200",
    desc: "Withdrawn from the conference by author.",
  },
};

export function SubmitterDashboard({
  orgId,
  eventId,
  orgSlug,
  eventSlug,
}: {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
}) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Withdraw state
  const [withdrawTarget, setWithdrawTarget] = useState<SubmissionDto | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // Versions dialog state (SUB-13)
  const [versionSub, setVersionSub] = useState<SubmissionDto | null>(null);
  const [versions, setVersions] = useState<SubmissionVersionDto[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: SubmissionDto[] }>(`${base}/submissions`);
      if (res.ok) {
        setSubmissions(res.data.data);
      } else {
        toast.error(res.error.message || "Failed to load submissions");
      }
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  // Load versions for SUB-13
  async function viewVersions(sub: SubmissionDto) {
    setVersionSub(sub);
    setVersionsLoading(true);
    try {
      const res = await apiFetch<SubmissionVersionDto[]>(
        `${base}/submissions/${sub.id}/versions`,
      );
      if (res.ok) {
        setVersions(res.data);
      } else {
        toast.error(res.error.message || "Failed to load version history");
      }
    } finally {
      setVersionsLoading(false);
    }
  }

  // Handle withdraw (SUB-13)
  async function confirmWithdraw() {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const res = await apiFetch(`${base}/submissions/${withdrawTarget.id}/actions`, {
        method: "POST",
        body: { action: "withdraw" },
      });
      if (res.ok) {
        toast.success("Submission withdrawn");
        setWithdrawTarget(null);
        await loadSubmissions();
      } else {
        toast.error(res.error.message || "Could not withdraw submission");
      }
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-10 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Submissions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track status, edit drafts, review decisions, and manage presentation slots.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => router.push(`/${orgSlug}/${eventSlug}/submit`)}
          className="gap-1.5 h-10 px-4"
        >
          <Plus className="size-4" />
          Submit New Abstract
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading submissions…</p>
        </div>
      ) : submissions.length === 0 ? (
        <Card className="border border-dashed border-border bg-white text-center py-12 px-6">
          <CardContent className="space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">No abstracts yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                You haven&apos;t submitted any abstracts for this event. Start by creating a draft.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => router.push(`/${orgSlug}/${eventSlug}/submit`)}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Create your first abstract
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => {
            const statusConfig = STATUS_CONFIG[sub.status] || STATUS_CONFIG.DRAFT!;
            const isDraftOrRevisions = ["DRAFT", "REVISIONS_REQUESTED"].includes(sub.status);
            const canWithdraw = ["DRAFT", "SUBMITTED"].includes(sub.status);
            const isAccepted = sub.status === "ACCEPTED" || sub.status === "CONFIRMED";
            const presenter = sub.authors?.find((a) => a.isPresenting);

            return (
              <Card
                key={sub.id}
                className="border border-border bg-white shadow-sm hover:border-border/80 transition-all"
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold px-2.5 py-0.5 border ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </Badge>
                      {sub.refNo ? (
                        <span className="font-mono text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                          {sub.refNo}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" />
                      <span>
                        Updated {new Date(sub.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <CardTitle className="text-lg font-bold text-foreground mt-2 leading-snug">
                    {sub.title || "Untitled Abstract"}
                  </CardTitle>

                  <CardDescription className="text-xs text-muted-foreground">
                    {statusConfig.desc}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pb-3">
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground">
                    {presenter ? (
                      <span>
                        Presenter: <strong className="text-foreground">{presenter.surname}, {presenter.initials}</strong>
                      </span>
                    ) : null}
                    <span>Word Count: <strong className="text-foreground">{sub.wordCount}</strong></span>
                    {sub.preferredPresentationType ? (
                      <span>Preference: <strong className="text-foreground uppercase">{sub.preferredPresentationType}</strong></span>
                    ) : null}
                  </div>

                  {/* SUB-16: Accepted Registration Callout */}
                  {isAccepted ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="size-4 text-emerald-600" />
                          Abstract accepted for presentation!
                        </p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          The presenting author must complete registration to confirm their slot in the programme.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shrink-0 h-9"
                        onClick={() => router.push(`/${orgSlug}/${eventSlug}/register`)}
                      >
                        Register now
                        <ChevronRight className="size-4 ml-1" />
                      </Button>
                    </div>
                  ) : null}
                </CardContent>

                <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-muted-foreground"
                      onClick={() => viewVersions(sub)}
                    >
                      <History className="size-3.5" />
                      History
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {canWithdraw ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setWithdrawTarget(sub)}
                      >
                        Withdraw
                      </Button>
                    ) : null}

                    {isDraftOrRevisions ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() =>
                          router.push(`/${orgSlug}/${eventSlug}/submit?id=${sub.id}`)
                        }
                      >
                        {sub.status === "REVISIONS_REQUESTED" ? "Edit Revisions" : "Continue Draft"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() =>
                          router.push(`/${orgSlug}/${eventSlug}/submit?id=${sub.id}`)
                        }
                      >
                        View Abstract
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Version History Dialog (SUB-13) */}
      <Dialog open={!!versionSub} onOpenChange={(open) => !open && setVersionSub(null)}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              <span>Version History</span>
            </DialogTitle>
            <DialogDescription>
              Changes are tracked automatically every time your abstract is updated or status is changed.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 max-h-[60vh] overflow-y-auto">
            {versionsLoading ? (
              <p className="text-xs text-muted-foreground">Loading versions…</p>
            ) : versions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No historical versions recorded yet.</p>
            ) : (
              versions.map((ver) => (
                <div
                  key={ver.id}
                  className="p-3 rounded-lg border border-border bg-muted/20 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="font-semibold text-foreground">Version {ver.version}</span>
                    <span className="text-muted-foreground">
                      {new Date(ver.createdAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Recorded by {ver.createdById ? "Author" : "System"}
                  </p>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVersionSub(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Confirmation Dialog */}
      <Dialog open={!!withdrawTarget} onOpenChange={(open) => !open && setWithdrawTarget(null)}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="size-5" />
              <span>Withdraw Abstract?</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw &quot;{withdrawTarget?.title}&quot;? Withdrawn abstracts will not be considered for review.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWithdrawTarget(null)}
              disabled={withdrawing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmWithdraw}
              disabled={withdrawing}
            >
              {withdrawing ? "Withdrawing…" : "Confirm Withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

