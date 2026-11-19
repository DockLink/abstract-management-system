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
import { Input } from "@/components/ui/input";
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
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Award,
  ChevronRight,
  ShieldCheck,
  Search,
  FileText,
  Loader2,
  Calendar,
  Lock,
} from "lucide-react";
import type { ReviewerDashboardDataDto } from "@/components/reviews/types";
import { ReviewerCertificateModal } from "./reviewer-certificate-modal";

interface Props {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
}

export function ReviewerDashboard({
  orgId,
  eventId,
  orgSlug,
  eventSlug,
}: Props) {
  const router = useRouter();
  const [data, setData] = useState<ReviewerDashboardDataDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Confidentiality acceptance
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Search & filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED">("ALL");

  // Certificate modal
  const [certModalOpen, setCertModalOpen] = useState(false);

  // COI modal
  const [coiModalOpen, setCoiModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [coiReason, setCoiReason] = useState("");
  const [declaringCoi, setDeclaringCoi] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<ReviewerDashboardDataDto>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/my-dashboard`,
    );

    if (res.ok) {
      setData(res.data);
    } else {
      toast.error(res.error.message || "Failed to load reviewer dashboard");
    }

    // Also get current user info
    const meRes = await apiFetch<{ id: string; fullName: string | null }>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviewers/me`,
    );
    if (meRes.ok) {
      setCurrentUserId(meRes.data.id);
    }

    setLoading(false);
  }, [orgId, eventId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Accept Confidentiality Agreement (REV-02)
  const handleAcceptConfidentiality = async () => {
    if (!agreeChecked) {
      toast.error("Please confirm agreement before continuing");
      return;
    }

    setAccepting(true);
    const res = await apiFetch(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/me/accept`,
      {
        method: "POST",
        body: { agreeToConfidentiality: true },
      },
    );
    setAccepting(false);

    if (res.ok) {
      toast.success("Confidentiality agreement accepted. Welcome to the Review Portal!");
      void loadDashboard();
    } else {
      toast.error(res.error.message || "Failed to accept confidentiality");
    }
  };

  // Declare Conflict of Interest (REV-07)
  const handleDeclareCoi = async () => {
    if (!selectedAssignmentId || !coiReason.trim()) {
      toast.error("Please provide a reason for the conflict of interest");
      return;
    }

    setDeclaringCoi(true);
    const res = await apiFetch(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments/${selectedAssignmentId}/conflict`,
      {
        method: "POST",
        body: { reason: coiReason.trim() },
      },
    );
    setDeclaringCoi(false);

    if (res.ok) {
      toast.success("Conflict of interest declared. The abstract has been reassigned.");
      setCoiModalOpen(false);
      setCoiReason("");
      setSelectedAssignmentId(null);
      void loadDashboard();
    } else {
      toast.error(res.error.message || "Failed to declare conflict");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your reviewer portal...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Review Portal Unavailable</h2>
        <p className="text-muted-foreground">
          You are not currently registered as a reviewer for this event, or your session has expired.
        </p>
        <Link href={`/${orgSlug}/${eventSlug}`}>
          <Button variant="outline">Back to Event</Button>
        </Link>
      </div>
    );
  }

  // ─── REV-02: Confidentiality Gate ───
  if (!data.hasAgreedToConfidentiality) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="border-2 border-indigo-200 dark:border-indigo-900 shadow-md">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold">Peer Review Confidentiality Agreement</CardTitle>
            <CardDescription className="text-sm">
              In accordance with academic standards and event guidelines, reviewers must agree to
              confidentiality terms before accessing any scientific submissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed border-y py-5 bg-slate-50/50 dark:bg-slate-900/50">
            <p>
              As a peer reviewer for this conference, you will be granted access to unpublished scientific
              abstracts and preliminary research. By proceeding, you agree to:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs md:text-sm">
              <li>
                <strong>Maintain Strict Confidentiality:</strong> You will not share, circulate, copy, or
                disclose any part of the abstracts or author details with third parties or AI tools.
              </li>
              <li>
                <strong>Declare Conflicts of Interest:</strong> If you identify an abstract authored by a
                close colleague, recent collaborator, or institutional peer, you agree to declare a
                conflict immediately using the button provided.
              </li>
              <li>
                <strong>Provide Objective, Constructive Feedback:</strong> Evaluations must adhere to the
                scoring rubric criteria fairly and without personal bias.
              </li>
            </ul>
            <div className="pt-3 border-t">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreeChecked}
                  onChange={(e) => setAgreeChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-100">
                  I have read, understood, and agree to the peer review confidentiality terms and
                  ethical guidelines.
                </span>
              </label>
            </div>
          </CardContent>
          <CardFooter className="pt-6 flex justify-between">
            <Link href={`/${orgSlug}/${eventSlug}`}>
              <Button variant="ghost">Decline & Exit</Button>
            </Link>
            <Button
              onClick={handleAcceptConfidentiality}
              disabled={!agreeChecked || accepting}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Accept & Begin Reviewing
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Filtered assignments
  const filteredAssignments = data.assignments.filter((a) => {
    // Filter by tab
    if (statusFilter === "PENDING" && a.status !== "PENDING") return false;
    if (statusFilter === "IN_PROGRESS" && a.status !== "IN_PROGRESS") return false;
    if (statusFilter === "COMPLETED" && a.status !== "COMPLETED") return false;

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = a.title?.toLowerCase().includes(q);
      const matchRef = a.refNo?.toLowerCase().includes(q);
      const matchCategory = a.category?.name?.toLowerCase().includes(q);
      return matchTitle || matchRef || matchCategory;
    }

    return true;
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* ─── Header & Certificate Action ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200">
              <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
              Reviewer Portal
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Peer Review Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Evaluate your assigned scientific abstracts, provide constructive feedback, and submit your scores.
          </p>
        </div>

        {/* Certificate Button (REV-14) */}
        {data.stats.completed > 0 && (
          <Button
            variant="outline"
            onClick={() => setCertModalOpen(true)}
            className="self-start md:self-auto gap-2 border-amber-300 bg-amber-50/50 hover:bg-amber-100/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300"
          >
            <Award className="h-4 w-4 text-amber-500" />
            Certificate of Appreciation
          </Button>
        )}
      </div>

      {/* ─── Metric Cards & Countdown (REV-09) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Deadline Countdown */}
        <Card className="border shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Review Deadline
              </div>
              <div className="text-2xl font-black mt-1 text-slate-900 dark:text-slate-100">
                {data.deadline.daysRemaining !== null ? (
                  data.deadline.isExpired ? (
                    <span className="text-rose-600">Expired</span>
                  ) : (
                    <span>
                      {data.deadline.daysRemaining}{" "}
                      <span className="text-xs font-medium text-muted-foreground">days left</span>
                    </span>
                  )
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">Not set</span>
                )}
              </div>
              {data.deadline.reviewDeadlineAt && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Due {new Date(data.deadline.reviewDeadlineAt).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Assigned */}
        <Card className="border shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assigned
              </div>
              <div className="text-2xl font-black mt-1 text-slate-900 dark:text-slate-100">
                {data.stats.totalAssigned}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {data.stats.pending} pending start
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card className="border shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                In Progress
              </div>
              <div className="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400">
                {data.stats.inProgress}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Draft saved</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="border shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Completed
              </div>
              <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
                {data.stats.completed}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Submitted reviews</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Search & Status Tabs ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === "ALL"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({data.assignments.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === "PENDING"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pending ({data.stats.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("IN_PROGRESS")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === "IN_PROGRESS"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            In Progress ({data.stats.inProgress})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("COMPLETED")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === "COMPLETED"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Completed ({data.stats.completed})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Search abstracts or ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      {/* ─── Assigned Abstracts Cards List ─── */}
      <div className="space-y-3">
        {filteredAssignments.length === 0 ? (
          <Card className="border-dashed p-12 text-center text-muted-foreground">
            <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium text-sm">No review assignments match your filter</p>
            <p className="text-xs mt-1">Check back later or adjust your search filter.</p>
          </Card>
        ) : (
          filteredAssignments.map((assignment) => {
            const isDone = assignment.status === "COMPLETED";
            const isInProgress = assignment.status === "IN_PROGRESS";
            const isConflict = assignment.status === "CONFLICT";

            return (
              <Card
                key={assignment.assignmentId}
                className="border shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all bg-white dark:bg-slate-900"
              >
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {assignment.refNo || "Draft"}
                      </span>
                      {assignment.category && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {assignment.category.name}
                        </Badge>
                      )}
                      {assignment.submissionType && (
                        <Badge variant="outline" className="text-xs font-normal">
                          {assignment.submissionType.name}
                        </Badge>
                      )}
                      {isConflict ? (
                        <Badge variant="destructive" className="text-xs">
                          Conflict Declared
                        </Badge>
                      ) : isDone ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs">
                          Review Submitted
                        </Badge>
                      ) : isInProgress ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs">
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Pending Start
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 line-clamp-2">
                      {assignment.title}
                    </h3>

                    {/* Review result summary if completed */}
                    {isDone && assignment.review && (
                      <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                        <span>
                          Score:{" "}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {assignment.review.weightedScore ?? "—"}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Recommendation:{" "}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {assignment.review.recommendation?.replace(/_/g, " ")}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                    {!isConflict && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedAssignmentId(assignment.assignmentId);
                          setCoiModalOpen(true);
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        Conflict?
                      </Button>
                    )}

                    {!isConflict ? (
                      <Link href={`/${orgSlug}/${eventSlug}/reviews/${assignment.assignmentId}`}>
                        <Button
                          size="sm"
                          className={
                            isDone
                              ? "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 font-semibold"
                              : "bg-primary text-primary-foreground font-semibold"
                          }
                        >
                          {isDone ? "View Review" : isInProgress ? "Continue Review" : "Start Review"}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        Reassigned by committee
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ─── Certificate Modal (REV-14) ─── */}
      <ReviewerCertificateModal
        orgId={orgId}
        eventId={eventId}
        reviewerId={currentUserId}
        open={certModalOpen}
        onOpenChange={setCertModalOpen}
      />

      {/* ─── Conflict of Interest Modal (REV-07) ─── */}
      <Dialog open={coiModalOpen} onOpenChange={setCoiModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              Declare Conflict of Interest
            </DialogTitle>
            <DialogDescription>
              Declaring a conflict of interest will return this abstract to the chair for
              reassignment. Please state your reason (e.g. colleague at the same department,
              collaborator, or financial conflict).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="coi-reason">Reason for Conflict</Label>
            <Textarea
              id="coi-reason"
              placeholder="Explain the conflict of interest..."
              value={coiReason}
              onChange={(e) => setCoiReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setCoiModalOpen(false)}
              disabled={declaringCoi}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeclareCoi}
              disabled={declaringCoi}
            >
              {declaringCoi && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Conflict Declaration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

