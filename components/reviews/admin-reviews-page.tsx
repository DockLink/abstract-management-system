"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/shared/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { PageSkeleton } from "@/components/shared/skeletons";
import { StatCard } from "@/components/shared/stat-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Users,
  Scale,
  AlertTriangle,
  Award,
  Plus,
  Trash2,
  Edit,
  Shuffle,
  Loader2,
  Bell,
  ShieldCheck,
} from "lucide-react";
import type {
  ReviewerItem,
  RubricCriterionItem,
  AssignmentItem,
  ProgressSummaryDto,
  SubmissionScoreRowDto,
} from "@/components/reviews/types";
import { ReviewerCertificateModal } from "./reviewer-certificate-modal";

interface Props {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
}

export function AdminReviewsPage({ orgId, eventId, orgSlug, eventSlug }: Props) {
  const [activeTab, setActiveTab] = useState<
    "progress" | "reviewers" | "rubric" | "assignments" | "scores"
  >("progress");

  // Category list
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  // Data states
  const [progress, setProgress] = useState<ProgressSummaryDto | null>(null);
  const [reviewers, setReviewers] = useState<ReviewerItem[]>([]);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterionItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [scoresTable, setScoresTable] = useState<SubmissionScoreRowDto[]>([]);

  // Submissions for manual assign
  const [submissionsList, setSubmissionsList] = useState<
    Array<{ id: string; refNo: string | null; title: string }>
  >([]);

  const [loading, setLoading] = useState(true);

  // ─── Modal States ───
  // Invite reviewer modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteCategories, setInviteCategories] = useState<string[]>([]);
  const [inviteMaxLoad, setInviteMaxLoad] = useState("20");
  const [inviting, setInviting] = useState(false);

  // Certificate modal
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string | null>(null);
  const [selectedReviewerName, setSelectedReviewerName] = useState<string | null>(null);

  // Rubric criterion modal
  const [criterionModalOpen, setCriterionModalOpen] = useState(false);
  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [criterionName, setCriterionName] = useState("");
  const [criterionDesc, setCriterionDesc] = useState("");
  const [criterionScaleMin, setCriterionScaleMin] = useState("1");
  const [criterionScaleMax, setCriterionScaleMax] = useState("5");
  const [criterionWeight, setCriterionWeight] = useState("1.0");
  const [savingCriterion, setSavingCriterion] = useState(false);

  // Auto-assign modal
  const [autoAssignModalOpen, setAutoAssignModalOpen] = useState(false);
  const [autoReviewersPerAbstract, setAutoReviewersPerAbstract] = useState("2");
  const [autoCategory, setAutoCategory] = useState<string>("");
  const [autoBalanceLoad, setAutoBalanceLoad] = useState(true);
  const [autoSkipInstitution, setAutoSkipInstitution] = useState(true);
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Bulk category assign modal
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [bulkCategorySelected, setBulkCategorySelected] = useState<string>("");
  const [bulkReviewersSelected, setBulkReviewersSelected] = useState<string[]>([]);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Manual assign modal
  const [manualAssignModalOpen, setManualAssignModalOpen] = useState(false);
  const [manualSubmissionId, setManualSubmissionId] = useState("");
  const [manualReviewerId, setManualReviewerId] = useState("");
  const [manualAssigning, setManualAssigning] = useState(false);

  // Reassign modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignAssignmentId, setReassignAssignmentId] = useState<string | null>(null);
  const [reassignNewReviewerId, setReassignNewReviewerId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassigning, setReassigning] = useState(false);

  // Reminders modal
  const [remindModalOpen, setRemindModalOpen] = useState(false);
  const [remindReviewerId, setRemindReviewerId] = useState<string | null>(null);
  const [remindMessage, setRemindMessage] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);

  // Scores Table filters
  const [scoreCategoryFilter, setScoreCategoryFilter] = useState("");
  const [scoreDisagreementThreshold, setScoreDisagreementThreshold] = useState("2.0");
  const [scoreSearch, setScoreSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ kind: "reviewer" | "criterion" | "assignment"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [scoreDetail, setScoreDetail] = useState<SubmissionScoreRowDto | null>(null);
  // Per-section load failures, so a failed fetch isn't mistaken for "nothing here".
  type Section = "progress" | "reviewers" | "rubric" | "assignments" | "scores";
  const [loadErrors, setLoadErrors] = useState<Partial<Record<Section, string>>>({});
  const noteLoad = useCallback((section: Section, res: { ok: boolean; error?: { message?: string } }) => {
    setLoadErrors((prev) => {
      const next = { ...prev };
      if (res.ok) delete next[section];
      else next[section] = res.error?.message || "This section couldn't be loaded.";
      return next;
    });
  }, []);

  // ─── Data Loading ───
  const loadCategories = useCallback(async () => {
    const res = await apiFetch<Array<{ id: string; name: string }>>(
      `/api/v1/orgs/${orgId}/events/${eventId}/categories`,
    );
    if (res.ok) setCategories(res.data);
  }, [orgId, eventId]);

  const loadProgress = useCallback(async () => {
    const res = await apiFetch<ProgressSummaryDto>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/progress`,
    );
    if (res.ok) setProgress(res.data);
    noteLoad("progress", res);
  }, [orgId, eventId, noteLoad]);

  const loadReviewers = useCallback(async () => {
    const res = await apiFetch<ReviewerItem[]>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviewers`,
    );
    if (res.ok) setReviewers(res.data);
    noteLoad("reviewers", res);
  }, [orgId, eventId, noteLoad]);

  const loadRubric = useCallback(async () => {
    const res = await apiFetch<RubricCriterionItem[]>(
      `/api/v1/orgs/${orgId}/events/${eventId}/rubric-criteria`,
    );
    if (res.ok) setRubricCriteria(res.data);
    noteLoad("rubric", res);
  }, [orgId, eventId, noteLoad]);

  const loadAssignments = useCallback(async () => {
    const res = await apiFetch<{ data: AssignmentItem[] }>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments?limit=100`,
    );
    if (res.ok) setAssignments(res.data.data);
    noteLoad("assignments", res);
  }, [orgId, eventId, noteLoad]);

  const loadScoresTable = useCallback(async () => {
    let url = `/api/v1/orgs/${orgId}/events/${eventId}/reviews/scores-table?limit=100`;
    if (scoreCategoryFilter) url += `&categoryId=${scoreCategoryFilter}`;
    if (scoreDisagreementThreshold) url += `&disagreementThreshold=${scoreDisagreementThreshold}`;
    if (scoreSearch) url += `&search=${encodeURIComponent(scoreSearch)}`;

    const res = await apiFetch<{ data: SubmissionScoreRowDto[] }>(url);
    if (res.ok) setScoresTable(res.data.data);
    noteLoad("scores", res);
  }, [orgId, eventId, scoreCategoryFilter, scoreDisagreementThreshold, scoreSearch, noteLoad]);

  const loadSubmissions = useCallback(async () => {
    const res = await apiFetch<{ data: Array<{ id: string; refNo: string | null; title: string }> }>(
      `/api/v1/orgs/${orgId}/events/${eventId}/submissions?limit=100`,
    );
    if (res.ok) setSubmissionsList(res.data.data);
  }, [orgId, eventId]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadCategories(),
      loadProgress(),
      loadReviewers(),
      loadRubric(),
      loadAssignments(),
      loadScoresTable(),
      loadSubmissions(),
    ]);
    setLoading(false);
  }, [
    loadCategories,
    loadProgress,
    loadReviewers,
    loadRubric,
    loadAssignments,
    loadScoresTable,
    loadSubmissions,
  ]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Refetch scores table when filters change
  useEffect(() => {
    if (activeTab === "scores") {
      void loadScoresTable();
    }
  }, [activeTab, loadScoresTable]);

  // ─── Actions ───

  // Invite Reviewer (REV-01)
  const handleInviteReviewer = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter reviewer email");
      return;
    }

    setInviting(true);
    const res = await apiFetch(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviewers/invite`,
      {
        method: "POST",
        body: {
          email: inviteEmail.trim(),
          fullName: inviteFullName.trim() || undefined,
          categoryIds: inviteCategories,
          maxLoad: parseInt(inviteMaxLoad, 10) || 20,
        },
      },
    );
    setInviting(false);

    if (res.ok) {
      toast.success("Reviewer invited successfully!");
      setInviteModalOpen(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteCategories([]);
      setInviteMaxLoad("20");
      void loadReviewers();
      void loadProgress();
    } else {
      toast.error(res.error.message || "Failed to invite reviewer");
    }
  };

  // Remove reviewer
  const handleRemoveReviewer = async (reviewerId: string, name: string, confirmed = false) => {
    if (!confirmed) {
      setPendingDelete({ kind: "reviewer", id: reviewerId, name });
      return;
    }

    const res = await apiFetch(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviewers/${reviewerId}`,
      { method: "DELETE" },
    );

    if (res.ok) {
      toast.success("Reviewer removed");
      void loadReviewers();
      void loadProgress();
    } else {
      toast.error(res.error.message || "Failed to remove reviewer");
    }
  };

  // Save Rubric Criterion (REV-04)
  const handleSaveCriterion = async () => {
    if (!criterionName.trim()) {
      toast.error("Please enter criterion name");
      return;
    }

    const min = parseInt(criterionScaleMin, 10) || 1;
    const max = parseInt(criterionScaleMax, 10) || 5;
    const weight = parseFloat(criterionWeight) || 1.0;

    if (max <= min) {
      toast.error("Max score must be greater than Min score");
      return;
    }

    setSavingCriterion(true);
    let res;
    if (editingCriterionId) {
      res = await apiFetch(
        `/api/v1/orgs/${orgId}/events/${eventId}/rubric-criteria/${editingCriterionId}`,
        {
          method: "PATCH",
          body: {
            name: criterionName.trim(),
            description: criterionDesc.trim() || null,
            scaleMin: min,
            scaleMax: max,
            weight,
          },
        },
      );
    } else {
      res = await apiFetch(
        `/api/v1/orgs/${orgId}/events/${eventId}/rubric-criteria`,
        {
          method: "POST",
          body: {
            name: criterionName.trim(),
            description: criterionDesc.trim() || null,
            scaleMin: min,
            scaleMax: max,
            weight,
          },
        },
      );
    }
    setSavingCriterion(false);

    if (res.ok) {
      toast.success(editingCriterionId ? "Criterion updated" : "Criterion created");
      setCriterionModalOpen(false);
      setEditingCriterionId(null);
      setCriterionName("");
      setCriterionDesc("");
      setCriterionScaleMin("1");
      setCriterionScaleMax("5");
      setCriterionWeight("1.0");
      void loadRubric();
    } else {
      toast.error(res.error.message || "Failed to save criterion");
    }
  };

  // Delete Rubric Criterion
  const handleDeleteCriterion = async (criterionId: string, confirmed = false) => {
    if (!confirmed) {
      setPendingDelete({ kind: "criterion", id: criterionId, name: rubricCriteria.find((c) => c.id === criterionId)?.name ?? "this criterion" });
      return;
    }

    const res = await apiFetch(
      `/api/v1/orgs/${orgId}/events/${eventId}/rubric-criteria/${criterionId}`,
      { method: "DELETE" },
    );

    if (res.ok) {
      toast.success("Criterion deleted");
      void loadRubric();
    } else {
      toast.error(res.error.message || "Failed to delete criterion");
    }
  };

  // Auto-Assign (REV-06)
  const handleRunAutoAssign = async () => {
    setAutoAssigning(true);
    const res = await apiFetch<{
      assignmentsCreated: number;
      totalSubmissionsProcessed: number;
      skippedSameInstitutionCount: number;
    }>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments/auto-assign`,
      {
        method: "POST",
        body: {
          reviewersPerAbstract: parseInt(autoReviewersPerAbstract, 10) || 2,
          categoryId: autoCategory || undefined,
          balanceLoad: autoBalanceLoad,
          skipSameInstitution: autoSkipInstitution,
        },
      },
    );
    setAutoAssigning(false);

    if (res.ok) {
      toast.success(
        `Auto-assign complete! Created ${res.data.assignmentsCreated} assignments. Avoided ${res.data.skippedSameInstitutionCount} institutional conflicts.`,
      );
      setAutoAssignModalOpen(false);
      void loadAssignments();
      void loadProgress();
    } else {
      toast.error(res.error.message || "Auto-assign failed");
    }
  };

  // Bulk Category Assign (REV-06)
  const handleBulkCategoryAssign = async () => {
    if (!bulkCategorySelected || bulkReviewersSelected.length === 0) {
      toast.error("Please select a category and at least one reviewer");
      return;
    }

    setBulkAssigning(true);
    const res = await apiFetch<{ count: number; submissionsCount: number }>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments/bulk-category`,
      {
        method: "POST",
        body: {
          categoryId: bulkCategorySelected,
          reviewerIds: bulkReviewersSelected,
        },
      },
    );
    setBulkAssigning(false);

    if (res.ok) {
      toast.success(
        `Bulk assigned ${res.data.count} reviews across ${res.data.submissionsCount} submissions!`,
      );
      setBulkCategoryModalOpen(false);
      setBulkCategorySelected("");
      setBulkReviewersSelected([]);
      void loadAssignments();
      void loadProgress();
    } else {
      toast.error(res.error.message || "Bulk assign failed");
    }
  };

  // Manual Assign
  const handleManualAssign = async () => {
    if (!manualSubmissionId || !manualReviewerId) {
      toast.error("Please select both a submission and a reviewer");
      return;
    }

    setManualAssigning(true);
    const res = await apiFetch(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments`,
      {
        method: "POST",
        body: {
          submissionId: manualSubmissionId,
          reviewerId: manualReviewerId,
        },
      },
    );
    setManualAssigning(false);

    if (res.ok) {
      toast.success("Review assignment created!");
      setManualAssignModalOpen(false);
      setManualSubmissionId("");
      setManualReviewerId("");
      void loadAssignments();
      void loadProgress();
    } else {
      toast.error(res.error.message || "Failed to create assignment");
    }
  };

  // Reassign Assignment (REV-13)
  const handleReassign = async () => {
    if (!reassignAssignmentId || !reassignNewReviewerId) {
      toast.error("Please select a new reviewer");
      return;
    }

    setReassigning(true);
    const res = await apiFetch(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments/${reassignAssignmentId}/reassign`,
      {
        method: "POST",
        body: {
          newReviewerId: reassignNewReviewerId,
          reason: reassignReason || undefined,
        },
      },
    );
    setReassigning(false);

    if (res.ok) {
      toast.success("Assignment reassigned successfully!");
      setReassignModalOpen(false);
      setReassignAssignmentId(null);
      setReassignNewReviewerId("");
      setReassignReason("");
      void loadAssignments();
      void loadProgress();
    } else {
      toast.error(res.error.message || "Failed to reassign reviewer");
    }
  };

  // Delete Assignment
  const handleDeleteAssignment = async (assignmentId: string, confirmed = false) => {
    if (!confirmed) {
      setPendingDelete({ kind: "assignment", id: assignmentId, name: "" });
      return;
    }

    const res = await apiFetch(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments/${assignmentId}`,
      { method: "DELETE" },
    );

    if (res.ok) {
      toast.success("Assignment removed");
      void loadAssignments();
      void loadProgress();
    } else {
      toast.error(res.error.message || "Failed to delete assignment");
    }
  };

  // Send Reminder (REV-10)
  const handleSendReminder = async () => {
    setSendingReminder(true);
    const res = await apiFetch<{ remindedCount: number }>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/remind`,
      {
        method: "POST",
        body: {
          reviewerId: remindReviewerId || undefined,
          allPending: !remindReviewerId,
          message: remindMessage.trim() || undefined,
        },
      },
    );
    setSendingReminder(false);

    if (res.ok) {
      toast.success(`Reminder recorded for ${res.data.remindedCount} reviewer${res.data.remindedCount === 1 ? "" : "s"}`, "It's in the audit log. Email delivery isn't connected yet.");
      setRemindModalOpen(false);
      setRemindReviewerId(null);
      setRemindMessage("");
    } else {
      toast.error("Couldn't record the reminders", { description: res.error.message });
    }
  };

  // One-click reminder for one reviewer (REV-10) — same endpoint as the dialog, no custom message.
  const handleQuickRemind = async (reviewerId: string, name: string) => {
    setRemindingId(reviewerId);
    const res = await apiFetch<{ remindedCount: number }>(`/api/v1/orgs/${orgId}/events/${eventId}/reviews/remind`, {
      method: "POST",
      body: { reviewerId, allPending: false },
    });
    setRemindingId(null);
    if (res.ok) {
      toast.success(
        res.data.remindedCount ? `Reminder recorded for ${name}` : `${name} has nothing outstanding`,
        res.data.remindedCount ? "It's in the audit log. Email delivery isn't connected yet." : undefined,
      );
    } else {
      toast.error("Couldn't send the reminder", { description: res.error.message });
    }
  };

  const runPendingDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === "reviewer") await handleRemoveReviewer(pendingDelete.id, pendingDelete.name, true);
      if (pendingDelete.kind === "criterion") await handleDeleteCriterion(pendingDelete.id, true);
      if (pendingDelete.kind === "assignment") await handleDeleteAssignment(pendingDelete.id, true);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  if (loading && !progress) {
    return <PageSkeleton variant="dashboard" />;
  }

  const TABS: Array<{ key: typeof activeTab; label: string; count?: number }> = [
    { key: "progress", label: "Progress" },
    { key: "scores", label: "Scores" },
    { key: "assignments", label: "Assignments", count: assignments.length },
    { key: "reviewers", label: "Reviewers", count: reviewers.length },
    { key: "rubric", label: "Rubric", count: rubricCriteria.length },
  ];

  const scoreColumns: DataTableColumn<SubmissionScoreRowDto>[] = [
    {
      id: "rank",
      header: "#",
      mobile: "meta",
      className: "w-10 tabular-nums text-muted-foreground",
      cell: (r) => <span className="text-sm text-muted-foreground tabular-nums">#{scoresTable.indexOf(r) + 1}</span>,
    },
    {
      id: "title",
      header: "Abstract",
      mobile: "title",
      cell: (r) => (
        <span className="block">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{r.refNo ?? "—"}</span>
            {r.isDisputed ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-danger-tint px-1.5 text-sm font-medium text-danger-foreground" title={r.disputeReason ?? undefined}>
                <AlertTriangle className="size-3.5" aria-hidden />
                Reviewers disagree
              </span>
            ) : null}
          </span>
          <span className="line-clamp-2 font-medium">{r.title}</span>
        </span>
      ),
    },
    { id: "track", header: "Track", className: "max-w-40", cell: (r) => r.categoryName ?? "—" },
    { id: "reviews", header: "Reviews", className: "whitespace-nowrap tabular-nums", cell: (r) => `${r.completedReviewCount} of ${r.assignedReviewCount}` },
    {
      id: "score",
      header: "Weighted avg",
      className: "tabular-nums",
      cell: (r) => (r.completedReviewCount ? <span className="text-base font-semibold">{r.weightedAverageScore.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      id: "spread",
      header: "Spread",
      className: "whitespace-nowrap tabular-nums",
      cell: (r) =>
        r.completedReviewCount > 1 ? (
          <span className={cn(r.isDisputed && "font-semibold text-danger-foreground")}>
            gap {r.scoreGap.toFixed(1)} · SD {r.standardDeviation.toFixed(2)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description="Reviewer progress, scores and assignments for this event."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setRemindReviewerId(null);
                setRemindModalOpen(true);
              }}
            >
              <Bell data-icon="inline-start" />
              Remind everyone…
            </Button>
            <Button onClick={() => setAutoAssignModalOpen(true)}>
              <Shuffle data-icon="inline-start" />
              Auto-assign…
            </Button>
          </>
        }
      />

      <div role="tablist" aria-label="Review sections" className="-mx-gutter flex gap-1 overflow-x-auto border-b border-border px-gutter md:mx-0 md:px-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "relative min-h-control shrink-0 px-4 text-base font-medium whitespace-nowrap",
              activeTab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count !== undefined ? <span className="ml-1.5 text-sm text-muted-foreground tabular-nums">{t.count}</span> : null}
            {activeTab === t.key ? <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-primary" /> : null}
          </button>
        ))}
      </div>

      {/* ─── Progress (REV-10) ─── */}
      {activeTab === "progress" && loadErrors.progress ? (
        <ErrorState title="Review progress didn't load" description={loadErrors.progress} onRetry={() => void loadProgress()} />
      ) : activeTab === "progress" && progress ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Abstracts" value={progress.overview.totalSubmissions} hint={`${progress.overview.underReviewSubmissions} under review`} />
            <StatCard label="Reviews assigned" value={progress.overview.totalAssignments} />
            <StatCard label="In progress" value={progress.overview.inProgressAssignments} hint={`${progress.overview.pendingAssignments} not started`} />
            <StatCard label="Done" value={`${progress.overview.percentComplete}%`} hint={`${progress.overview.completedAssignments} reviews`} progress={progress.overview.percentComplete} />
            <StatCard
              label="Conflicts"
              value={progress.overview.conflictAssignments}
              hint="Need reassigning"
              tone={progress.overview.conflictAssignments ? "warning" : "default"}
              className="col-span-2 lg:col-span-1"
            />
          </div>

          <section aria-labelledby="per-reviewer">
            <h2 id="per-reviewer" className="font-heading text-2xl font-semibold">Reviewers</h2>
            <p className="mt-1 text-base text-muted-foreground">Sorted by least done first. “Remind” records a reminder for that reviewer.</p>
            {progress.reviewers.length === 0 ? (
              <EmptyState
                compact
                icon={Users}
                title="No reviewers yet"
                description="Invite reviewers from the Reviewers tab, then assign abstracts."
                action={<Button variant="outline" onClick={() => setActiveTab("reviewers")}>Go to reviewers</Button>}
              />
            ) : (
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {[...progress.reviewers]
                  .sort((x, y) => x.percentComplete - y.percentComplete)
                  .map((r) => {
                    const name = r.fullName || r.email;
                    const outstanding = r.pendingCount + r.inProgressCount;
                    return (
                      <li key={r.userId} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold">{name}</p>
                            <p className="text-sm text-muted-foreground">
                              {r.completedCount} of {r.assignedCount} done
                              {r.inProgressCount ? ` · ${r.inProgressCount} in progress` : ""}
                              {r.conflictCount ? ` · ${r.conflictCount} conflict` : ""}
                            </p>
                          </div>
                          <span className={cn("text-xl font-semibold tabular-nums", r.percentComplete === 100 ? "text-success-foreground" : r.percentComplete < 50 ? "text-warning-foreground" : "")}>
                            {r.percentComplete}%
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div className="h-full rounded-full bg-primary" style={{ width: `${r.percentComplete}%` }} />
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!outstanding || remindingId === r.userId}
                            onClick={() => void handleQuickRemind(r.userId, name)}
                          >
                            {remindingId === r.userId ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Bell data-icon="inline-start" />}
                            {outstanding ? "Remind" : "All done"}
                            <span className="sr-only"> {name}</span>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>

          <section aria-labelledby="per-track">
            <h2 id="per-track" className="font-heading text-2xl font-semibold">Tracks</h2>
            {progress.categories.length === 0 ? (
              <p className="mt-2 text-base text-muted-foreground">No tracks yet.</p>
            ) : (
              <ul className="mt-4 space-y-4 rounded-lg border border-border bg-card p-4 md:p-5">
                {progress.categories.map((c) => (
                  <li key={c.categoryId}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-base font-medium">{c.categoryName}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {c.completedCount} of {c.assignedCount} reviews · {c.submissionCount} abstract{c.submissionCount === 1 ? "" : "s"} ·{" "}
                        <strong className="text-foreground">{c.percentComplete}%</strong>
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`${c.categoryName}: ${c.percentComplete}% of reviews complete`}
                    >
                      <div className="h-full rounded-full bg-primary" style={{ width: `${c.percentComplete}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {/* ─── TAB 2: Reviewer Pool (REV-01, REV-02, REV-14) ─── */}
      {activeTab === "reviewers" && loadErrors.reviewers ? (
        <ErrorState title="The reviewer pool didn't load" description={loadErrors.reviewers} onRetry={() => void loadReviewers()} />
      ) : activeTab === "reviewers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Reviewer pool</h2>
              <p className="text-xs text-muted-foreground">
                Manage reviewers invited to this conference, their expertise categories, and max capacities.
              </p>
            </div>
            <Button
              onClick={() => setInviteModalOpen(true)}
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground font-semibold"
            >
              <Plus className="h-4 w-4" />
              Invite reviewer
            </Button>
          </div>

          <Card className="border shadow-xs">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted  text-muted-foreground font-semibold">
                    <th className="p-3 pl-5">Reviewer</th>
                    <th className="p-3">Institution</th>
                    <th className="p-3">Expertise categories</th>
                    <th className="p-3">Max load</th>
                    <th className="p-3">Invitation & confidentiality</th>
                    <th className="p-3 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reviewers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No reviewers in pool yet. Click &quot;Invite Reviewer&quot; above to invite reviewers by email.
                      </td>
                    </tr>
                  ) : (
                    reviewers.map((r) => (
                      <tr key={r.id} className="hover:bg-muted">
                        <td className="p-3 pl-5">
                          <div className="font-semibold text-foreground ">
                            {r.fullName || "—"}
                          </div>
                          <div className="text-muted-foreground text-xs">{r.email}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{r.institution || "—"}</td>
                        <td className="p-3">
                          {r.categories && r.categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.categories.map((c) => (
                                <Badge key={c.id} variant="secondary" className="text-xs">
                                  {c.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">
                              General (all categories)
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-semibold">{r.maxLoad} abstracts</td>
                        <td className="p-3 space-y-1">
                          <div>
                            {r.invitationStatus === "ACCEPTED" ? (
                              <Badge className="bg-success hover:bg-success text-xs">
                                Accepted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-warning-foreground">
                                Pending invite
                              </Badge>
                            )}
                          </div>
                          {r.confidentialityAgreedAt ? (
                            <span className="text-xs text-success-foreground flex items-center gap-1 font-medium">
                              <ShieldCheck className="h-3 w-3" />
                              Confidentiality signed
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Awaiting signature
                            </span>
                          )}
                        </td>
                        <td className="p-3 pr-5 text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedReviewerId(r.userId);
                              setSelectedReviewerName(r.fullName || r.email);
                              setCertModalOpen(true);
                            }}
                            className="h-7 text-xs text-warning-foreground hover:text-warning-foreground hover:bg-warning-tint"
                            title="View certificate of appreciation"
                          >
                            <Award className="h-3.5 w-3.5 mr-1" />
                            Certificate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveReviewer(r.id, r.fullName || r.email)}
                            className="h-7 text-xs text-danger-foreground hover:text-danger-foreground hover:bg-danger-tint"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB 3: Rubric Builder (REV-04) ─── */}
      {activeTab === "rubric" && loadErrors.rubric ? (
        <ErrorState title="The rubric didn't load" description={loadErrors.rubric} onRetry={() => void loadRubric()} />
      ) : activeTab === "rubric" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Scoring rubric builder</h2>
              <p className="text-xs text-muted-foreground">
                Define the criteria, scales (e.g. 1 to 5 or 1 to 10), and weights used by reviewers during evaluation.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingCriterionId(null);
                setCriterionName("");
                setCriterionDesc("");
                setCriterionScaleMin("1");
                setCriterionScaleMax("5");
                setCriterionWeight("1.0");
                setCriterionModalOpen(true);
              }}
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add rubric criterion
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rubricCriteria.length === 0 ? (
              <div className="col-span-2 p-12 border-2 border-dashed rounded-xl text-center text-muted-foreground space-y-2">
                <Scale className="h-8 w-8 mx-auto opacity-50" />
                <p className="font-semibold text-sm">No scoring criteria configured</p>
                <p className="text-xs">
                  Click &quot;Add Rubric Criterion&quot; to define evaluation parameters (e.g. Scientific Rigour, Originality, Clarity).
                </p>
              </div>
            ) : (
              rubricCriteria.map((c) => (
                <Card key={c.id} className="border shadow-xs bg-card  flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-bold">{c.name}</CardTitle>
                        {c.description && (
                          <CardDescription className="text-xs mt-1">
                            {c.description}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Weight: {c.weight}x
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {/* Scale preview */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-xs text-muted-foreground font-semibold ">
                        Scale:
                      </span>
                      <div className="flex gap-1">
                        {Array.from(
                          { length: c.scaleMax - c.scaleMin + 1 },
                          (_, i) => c.scaleMin + i,
                        ).map((v) => (
                          <span
                            key={v}
                            className="px-2 py-0.5 rounded-sm bg-muted  text-xs font-mono font-medium"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                  <CardContent className="p-4 pt-0 border-t flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingCriterionId(c.id);
                        setCriterionName(c.name);
                        setCriterionDesc(c.description || "");
                        setCriterionScaleMin(String(c.scaleMin));
                        setCriterionScaleMax(String(c.scaleMax));
                        setCriterionWeight(String(c.weight));
                        setCriterionModalOpen(true);
                      }}
                      className="h-7 text-xs"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCriterion(c.id)}
                      className="h-7 text-xs text-danger-foreground hover:text-danger-foreground hover:bg-danger-tint"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: Assignments & Auto-Assign (REV-06, REV-13) ─── */}
      {activeTab === "assignments" && loadErrors.assignments ? (
        <ErrorState title="Assignments didn't load" description={loadErrors.assignments} onRetry={() => void loadAssignments()} />
      ) : activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Review assignments</h2>
              <p className="text-xs text-muted-foreground">
                Assign reviewers manually, in bulk by category, or with the automatic load-balancing engine.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManualAssignModalOpen(true)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Manual assign
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkCategoryModalOpen(true)}
                className="gap-1.5"
              >
                <Users className="h-4 w-4" />
                Bulk by category
              </Button>
              <Button
                size="sm"
                onClick={() => setAutoAssignModalOpen(true)}
                className="gap-1.5 bg-primary text-primary-foreground font-semibold"
              >
                <Shuffle className="h-4 w-4" />
                Auto-assign engine
              </Button>
            </div>
          </div>

          <Card className="border shadow-xs">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted  text-muted-foreground font-semibold">
                    <th className="p-3 pl-5">Abstract</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Reviewer</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Score & outcome</th>
                    <th className="p-3 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No review assignments created yet. Click &quot;Auto-Assign Engine&quot; to automatically distribute submissions to reviewers.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-muted">
                        <td className="p-3 pl-5 max-w-[280px]">
                          <span className="font-mono text-xs font-semibold text-foreground ">
                            {a.submission?.refNo || "—"}
                          </span>
                          <div className="font-semibold text-foreground  truncate">
                            {a.submission?.title}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {a.submission?.category?.name || "—"}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold">
                            {a.reviewer?.fullName || a.reviewer?.email}
                          </div>
                          {a.reviewer?.institution && (
                            <div className="text-xs text-muted-foreground italic">
                              {a.reviewer.institution}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {a.status === "COMPLETED" ? (
                            <Badge className="bg-success hover:bg-success text-xs">
                              Completed
                            </Badge>
                          ) : a.status === "IN_PROGRESS" ? (
                            <Badge variant="secondary" className="bg-warning-tint text-warning-foreground text-xs">
                              In progress
                            </Badge>
                          ) : a.status === "CONFLICT" ? (
                            <Badge variant="destructive" className="text-xs">
                              Conflict
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Pending
                            </Badge>
                          )}
                          {a.coiReason && (
                            <p className="text-xs text-danger-foreground mt-1 italic">
                              Reason: {a.coiReason}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          {a.review && !a.review.isDraft ? (
                            <div className="space-y-0.5">
                              <Badge variant="outline" className="text-xs">
                                {a.review.recommendation?.replace(/_/g, " ")}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 pr-5 text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReassignAssignmentId(a.id);
                              setReassignNewReviewerId("");
                              setReassignReason("");
                              setReassignModalOpen(true);
                            }}
                            className="h-7 text-xs text-info-foreground hover:text-info-foreground hover:bg-info-tint"
                            title="Reassign to another reviewer"
                          >
                            Reassign
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAssignment(a.id)}
                            className="h-7 text-xs text-danger-foreground hover:text-danger-foreground hover:bg-danger-tint"
                            title="Unassign"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Scores (REV-11, REV-12) ─── */}
      {activeTab === "scores" ? (
        <div className="space-y-4">
          <FilterBar
            search={scoreSearch}
            onSearchChange={setScoreSearch}
            searchPlaceholder="Search title or reference"
            searchLabel="Search abstracts"
            activeCount={scoreCategoryFilter ? 1 : 0}
            onClear={() => {
              setScoreSearch("");
              setScoreCategoryFilter("");
            }}
            resultCount={{
              shown: scoresTable.length,
              noun: `abstracts · ${scoresTable.filter((r) => r.isDisputed).length} with disagreement`,
            }}
          >
            <Select value={scoreCategoryFilter || "all"} onValueChange={(v) => setScoreCategoryFilter(v === "all" ? "" : v)}>
              <SelectTrigger aria-label="Filter by track">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tracks</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm whitespace-nowrap">
              Flag a gap of
              <Input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={scoreDisagreementThreshold}
                onChange={(e) => setScoreDisagreementThreshold(e.target.value)}
                className="w-20"
                aria-label="Disagreement threshold"
              />
              or more
            </label>
          </FilterBar>
          <DataTable
            caption="Scores by abstract, highest first"
            columns={scoreColumns}
            rows={scoresTable}
            getRowId={(r) => r.submissionId}
            error={loadErrors.scores}
            onRetry={() => void loadScoresTable()}
            rowClassName={(r) => (r.isDisputed ? "bg-danger-tint/40 border-danger/30" : undefined)}
            empty={{
              icon: Scale,
              title: "No scores yet",
              description: "Scores appear as reviewers submit their reviews.",
            }}
            rowActions={(r) => (
              <Button size="sm" variant="outline" onClick={() => setScoreDetail(r)} disabled={!r.reviews.length}>
                Reviews ({r.reviews.length})
                <span className="sr-only"> for {r.refNo ?? r.title}</span>
              </Button>
            )}
          />
        </div>
      ) : null}

      <SidePanel
        open={!!scoreDetail}
        onOpenChange={(o) => !o && setScoreDetail(null)}
        size="lg"
        title={scoreDetail?.refNo ?? "Reviews"}
        description={scoreDetail?.title}
        footer={<Button variant="outline" onClick={() => setScoreDetail(null)}>Close</Button>}
      >
        {scoreDetail ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border p-3">
                <dt className="text-sm text-muted-foreground">Weighted avg</dt>
                <dd className="text-xl font-semibold tabular-nums">{scoreDetail.weightedAverageScore.toFixed(2)}</dd>
              </div>
              <div className="rounded-md border border-border p-3">
                <dt className="text-sm text-muted-foreground">Gap</dt>
                <dd className={cn("text-xl font-semibold tabular-nums", scoreDetail.isDisputed && "text-danger-foreground")}>{scoreDetail.scoreGap.toFixed(1)}</dd>
              </div>
              <div className="rounded-md border border-border p-3">
                <dt className="text-sm text-muted-foreground">SD</dt>
                <dd className="text-xl font-semibold tabular-nums">{scoreDetail.standardDeviation.toFixed(2)}</dd>
              </div>
            </dl>
            {scoreDetail.isDisputed && scoreDetail.disputeReason ? (
              <p className="flex items-start gap-2 rounded-md bg-danger-tint px-3 py-2 text-base text-danger-foreground">
                <AlertTriangle className="mt-1 size-4 shrink-0" aria-hidden />
                {scoreDetail.disputeReason.replace(/\.?\s*$/, ".")} Consider adding a third reviewer from Assignments.
              </p>
            ) : null}
            <ol className="space-y-3">
              {scoreDetail.reviews.map((rv, i) => (
                <li key={rv.reviewerId} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-base font-semibold">{rv.reviewerName ?? `Reviewer ${i + 1}`}</p>
                    <p className="text-base tabular-nums">
                      <strong>{rv.weightedScore.toFixed(2)}</strong>
                      {rv.recommendation ? <span className="ml-2 text-sm text-muted-foreground">{rv.recommendation.replace("_", " ").toLowerCase()}</span> : null}
                    </p>
                  </div>
                  <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                    {rv.criterionScores.map((cs) => (
                      <li key={cs.criterionId} className="flex justify-between gap-2">
                        <span className="truncate text-muted-foreground">{cs.criterionName}</span>
                        <span className="font-semibold tabular-nums">{cs.score}</span>
                      </li>
                    ))}
                  </ul>
                  {rv.commentCommittee ? (
                    <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm"><span className="font-medium">To committee:</span> {rv.commentCommittee}</p>
                  ) : null}
                  {rv.commentAuthor ? (
                    <p className="mt-2 text-sm"><span className="font-medium">To authors:</span> {rv.commentAuthor}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </SidePanel>

      {/* ─── MODAL: Invite Reviewer (REV-01) ─── */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite peer reviewer</DialogTitle>
            <DialogDescription>
              Invite a senior consultant or reviewer by email, record their expertise tracks, and set max workload capacity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rev-email">Reviewer email *</Label>
              <Input
                id="rev-email"
                placeholder="reviewer@hospital.org"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-name">Full name (optional)</Label>
              <Input
                id="rev-name"
                placeholder="Prof. / Dr. ..."
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expertise categories</Label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 border rounded-lg">
                {categories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteCategories.includes(cat.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setInviteCategories([...inviteCategories, cat.id]);
                        } else {
                          setInviteCategories(inviteCategories.filter((id) => id !== cat.id));
                        }
                      }}
                      className="rounded border-border text-primary"
                    />
                    <span className="truncate">{cat.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave unchecked if reviewer can evaluate submissions in all categories.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-max">Max capacity load</Label>
              <Input
                id="rev-max"
                type="number"
                min="1"
                max="200"
                value={inviteMaxLoad}
                onChange={(e) => setInviteMaxLoad(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setInviteModalOpen(false)} disabled={inviting}>
              Cancel
            </Button>
            <Button onClick={handleInviteReviewer} disabled={inviting}>
              {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Rubric Criterion (REV-04) ─── */}
      <Dialog open={criterionModalOpen} onOpenChange={setCriterionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCriterionId ? "Edit scoring criterion" : "Add rubric scoring criterion"}
            </DialogTitle>
            <DialogDescription>
              Define scoring criteria, numeric scale bounds, and formula weight.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="crit-name">Criterion name *</Label>
              <Input
                id="crit-name"
                placeholder="e.g. Scientific Rigour, Originality, Clarity"
                value={criterionName}
                onChange={(e) => setCriterionName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crit-desc">Description (Help text for reviewers)</Label>
              <Textarea
                id="crit-desc"
                placeholder="Explain what reviewers should look for when scoring this parameter..."
                value={criterionDesc}
                onChange={(e) => setCriterionDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="crit-min">Min scale</Label>
                <Input
                  id="crit-min"
                  type="number"
                  value={criterionScaleMin}
                  onChange={(e) => setCriterionScaleMin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crit-max">Max scale</Label>
                <Input
                  id="crit-max"
                  type="number"
                  value={criterionScaleMax}
                  onChange={(e) => setCriterionScaleMax(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crit-weight">Weight (x)</Label>
                <Input
                  id="crit-weight"
                  type="number"
                  step="0.5"
                  value={criterionWeight}
                  onChange={(e) => setCriterionWeight(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setCriterionModalOpen(false)}
              disabled={savingCriterion}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveCriterion} disabled={savingCriterion}>
              {savingCriterion && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save criterion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Auto-Assign Engine (REV-06) ─── */}
      <Dialog open={autoAssignModalOpen} onOpenChange={setAutoAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle className="h-5 w-5 text-primary" />
              Automated reviewer assignment
            </DialogTitle>
            <DialogDescription>
              Automatically assign peer reviewers to submitted abstracts balancing reviewer workload, matching category expertise, and avoiding institutional conflicts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="auto-count">Reviewers per abstract</Label>
              <Input
                id="auto-count"
                type="number"
                min="1"
                max="10"
                value={autoReviewersPerAbstract}
                onChange={(e) => setAutoReviewersPerAbstract(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Standard default is 2 reviewers per submission.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auto-cat">Target category (optional)</Label>
              <select
                id="auto-cat"
                value={autoCategory}
                onChange={(e) => setAutoCategory(e.target.value)}
                className="w-full h-9 text-xs border rounded-lg px-2 bg-card "
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 border-t pt-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSkipInstitution}
                  onChange={(e) => setAutoSkipInstitution(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <span className="font-medium text-xs">
                  Skip same-institution reviewers (prevent conflict of interest)
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBalanceLoad}
                  onChange={(e) => setAutoBalanceLoad(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <span className="font-medium text-xs">
                  Balance reviewer workloads evenly (fewest assignments first)
                </span>
              </label>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setAutoAssignModalOpen(false)}
              disabled={autoAssigning}
            >
              Cancel
            </Button>
            <Button onClick={handleRunAutoAssign} disabled={autoAssigning}>
              {autoAssigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Run auto-assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Bulk Category Assign (REV-06) ─── */}
      <Dialog open={bulkCategoryModalOpen} onOpenChange={setBulkCategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk assign by category</DialogTitle>
            <DialogDescription>
              Assign selected reviewers to all submissions currently submitted in a track.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <select
                value={bulkCategorySelected}
                onChange={(e) => setBulkCategorySelected(e.target.value)}
                className="w-full h-9 text-xs border rounded-lg px-2 bg-card "
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Select reviewers *</Label>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1.5 text-xs">
                {reviewers.map((r) => (
                  <label key={r.userId} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkReviewersSelected.includes(r.userId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkReviewersSelected([...bulkReviewersSelected, r.userId]);
                        } else {
                          setBulkReviewersSelected(bulkReviewersSelected.filter((id) => id !== r.userId));
                        }
                      }}
                      className="rounded border-border text-primary"
                    />
                    <span>
                      {r.fullName || r.email} ({r.assignedCount}/{r.maxLoad})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkCategoryModalOpen(false)}
              disabled={bulkAssigning}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkCategoryAssign} disabled={bulkAssigning}>
              {bulkAssigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign reviewers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Manual Assign ─── */}
      <Dialog open={manualAssignModalOpen} onOpenChange={setManualAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual reviewer assignment</DialogTitle>
            <DialogDescription>
              Assign or add a reviewer to a specific submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Select submission *</Label>
              <select
                value={manualSubmissionId}
                onChange={(e) => setManualSubmissionId(e.target.value)}
                className="w-full h-9 text-xs border rounded-lg px-2 bg-card "
              >
                <option value="">Select submission...</option>
                {submissionsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.refNo ? `[${s.refNo}] ` : ""}
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Select reviewer *</Label>
              <select
                value={manualReviewerId}
                onChange={(e) => setManualReviewerId(e.target.value)}
                className="w-full h-9 text-xs border rounded-lg px-2 bg-card "
              >
                <option value="">Select reviewer...</option>
                {reviewers.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.fullName || r.email} ({r.assignedCount}/{r.maxLoad} load)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setManualAssignModalOpen(false)}
              disabled={manualAssigning}
            >
              Cancel
            </Button>
            <Button onClick={handleManualAssign} disabled={manualAssigning}>
              {manualAssigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Reassign (REV-13) ─── */}
      <Dialog open={reassignModalOpen} onOpenChange={setReassignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign reviewer</DialogTitle>
            <DialogDescription>
              Transfer this assignment to a new reviewer. Any prior draft will be cleared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>New reviewer *</Label>
              <select
                value={reassignNewReviewerId}
                onChange={(e) => setReassignNewReviewerId(e.target.value)}
                className="w-full h-9 text-xs border rounded-lg px-2 bg-card "
              >
                <option value="">Select new reviewer...</option>
                {reviewers.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.fullName || r.email} ({r.assignedCount}/{r.maxLoad} load)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Reason for reassignment</Label>
              <Input
                placeholder="e.g. Conflict of interest, unresponsive reviewer..."
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setReassignModalOpen(false)}
              disabled={reassigning}
            >
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={reassigning}>
              {reassigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Send Reminders (REV-10) ─── */}
      <Dialog open={remindModalOpen} onOpenChange={setRemindModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-warning-foreground" />
              Remind reviewers
            </DialogTitle>
            <DialogDescription>
              {remindReviewerId
                ? "Record a reminder for this reviewer's outstanding reviews. Email delivery isn't connected yet, so it's logged only."
                : "Record a reminder for every reviewer with reviews not yet submitted. Email delivery isn't connected yet, so it's logged only."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="remind-msg">Note (optional)</Label>
              <Textarea
                id="remind-msg"
                placeholder="e.g. Reviews close on 30 November 2026."
                value={remindMessage}
                onChange={(e) => setRemindMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRemindModalOpen(false)}
              disabled={sendingReminder}
            >
              Cancel
            </Button>
            <Button onClick={handleSendReminder} disabled={sendingReminder}>
              {sendingReminder && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record reminders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Reviewer Certificate (REV-14) ─── */}
      <ReviewerCertificateModal
        orgId={orgId}
        eventId={eventId}
        reviewerId={selectedReviewerId}
        reviewerName={selectedReviewerName}
        open={certModalOpen}
        onOpenChange={setCertModalOpen}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={
          pendingDelete?.kind === "reviewer"
            ? `Remove ${pendingDelete.name} from the reviewer pool?`
            : pendingDelete?.kind === "criterion"
              ? `Delete “${pendingDelete.name}”?`
              : "Unassign this reviewer?"
        }
        description={
          pendingDelete?.kind === "reviewer"
            ? "They won't be able to review for this event."
            : pendingDelete?.kind === "criterion"
              ? "Scores already given for this criterion are removed. Weighted totals will change."
              : "Any review already written for this assignment is deleted too. You can't undo this."
        }
        confirmLabel={pendingDelete?.kind === "reviewer" ? "Remove reviewer" : pendingDelete?.kind === "criterion" ? "Delete criterion" : "Unassign"}
        destructive
        loading={deleting}
        onConfirm={runPendingDelete}
      />
    </div>
  );
}
