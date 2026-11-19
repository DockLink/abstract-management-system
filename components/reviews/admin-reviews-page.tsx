"use client";

import { useCallback, useEffect, useState } from "react";
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
  ClipboardCheck,
  Users,
  Scale,
  Send,
  AlertTriangle,
  Award,
  Plus,
  Trash2,
  Edit,
  Shuffle,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  Loader2,
  Bell,
  ChevronDown,
  ChevronUp,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown,
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
  const [expandedSubmissions, setExpandedSubmissions] = useState<Record<string, boolean>>({});

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
  }, [orgId, eventId]);

  const loadReviewers = useCallback(async () => {
    const res = await apiFetch<ReviewerItem[]>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviewers`,
    );
    if (res.ok) setReviewers(res.data);
  }, [orgId, eventId]);

  const loadRubric = useCallback(async () => {
    const res = await apiFetch<RubricCriterionItem[]>(
      `/api/v1/orgs/${orgId}/events/${eventId}/rubric-criteria`,
    );
    if (res.ok) setRubricCriteria(res.data);
  }, [orgId, eventId]);

  const loadAssignments = useCallback(async () => {
    const res = await apiFetch<{ data: AssignmentItem[] }>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/assignments?limit=100`,
    );
    if (res.ok) setAssignments(res.data.data);
  }, [orgId, eventId]);

  const loadScoresTable = useCallback(async () => {
    let url = `/api/v1/orgs/${orgId}/events/${eventId}/reviews/scores-table?limit=100`;
    if (scoreCategoryFilter) url += `&categoryId=${scoreCategoryFilter}`;
    if (scoreDisagreementThreshold) url += `&disagreementThreshold=${scoreDisagreementThreshold}`;
    if (scoreSearch) url += `&search=${encodeURIComponent(scoreSearch)}`;

    const res = await apiFetch<{ data: SubmissionScoreRowDto[] }>(url);
    if (res.ok) setScoresTable(res.data.data);
  }, [orgId, eventId, scoreCategoryFilter, scoreDisagreementThreshold, scoreSearch]);

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
  const handleRemoveReviewer = async (reviewerId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove reviewer ${name} from this event?`)) {
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
  const handleDeleteCriterion = async (criterionId: string) => {
    if (!confirm("Delete this scoring rubric criterion? Existing scores for this criterion will be removed.")) {
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
  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to unassign this reviewer?")) return;

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
      toast.success(`Reminder sent to ${res.data.remindedCount} reviewer(s)!`);
      setRemindModalOpen(false);
      setRemindReviewerId(null);
      setRemindMessage("");
    } else {
      toast.error(res.error.message || "Failed to send reminders");
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            Review Portal Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure reviewer pools, scoring rubrics, automated assignments, and monitor peer review progress.
          </p>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRemindReviewerId(null);
              setRemindModalOpen(true);
            }}
            className="gap-1.5"
          >
            <Bell className="h-4 w-4 text-amber-500" />
            Send Reminders
          </Button>
          <Button
            size="sm"
            onClick={() => setAutoAssignModalOpen(true)}
            className="gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            <Shuffle className="h-4 w-4" />
            Auto-Assign Reviewers
          </Button>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="border-b flex items-center gap-2 overflow-x-auto text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("progress")}
          className={`py-3 px-4 border-b-2 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "progress"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          Progress & Reminders
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reviewers")}
          className={`py-3 px-4 border-b-2 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "reviewers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Reviewer Pool ({reviewers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rubric")}
          className={`py-3 px-4 border-b-2 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "rubric"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scale className="h-4 w-4" />
          Scoring Rubric ({rubricCriteria.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("assignments")}
          className={`py-3 px-4 border-b-2 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "assignments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          Assignments ({assignments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("scores")}
          className={`py-3 px-4 border-b-2 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "scores"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowUpDown className="h-4 w-4" />
          Scores & Disagreements
        </button>
      </div>

      {/* ─── TAB 1: Progress & Reminders (REV-10) ─── */}
      {activeTab === "progress" && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          {progress && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="border shadow-xs">
                <CardContent className="p-4">
                  <div className="text-xs uppercase font-semibold text-muted-foreground">
                    Submissions
                  </div>
                  <div className="text-2xl font-black mt-1">
                    {progress.overview.totalSubmissions}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {progress.overview.underReviewSubmissions} under review
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-xs">
                <CardContent className="p-4">
                  <div className="text-xs uppercase font-semibold text-muted-foreground">
                    Assignments
                  </div>
                  <div className="text-2xl font-black mt-1">
                    {progress.overview.totalAssignments}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {progress.overview.pendingAssignments} pending start
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-xs">
                <CardContent className="p-4">
                  <div className="text-xs uppercase font-semibold text-muted-foreground">
                    In Progress
                  </div>
                  <div className="text-2xl font-black mt-1 text-amber-600">
                    {progress.overview.inProgressAssignments}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Draft saved</div>
                </CardContent>
              </Card>

              <Card className="border shadow-xs">
                <CardContent className="p-4">
                  <div className="text-xs uppercase font-semibold text-muted-foreground">
                    Completed
                  </div>
                  <div className="text-2xl font-black mt-1 text-emerald-600">
                    {progress.overview.completedAssignments}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {progress.overview.percentComplete}% overall
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-xs col-span-2 md:col-span-1">
                <CardContent className="p-4">
                  <div className="text-xs uppercase font-semibold text-muted-foreground">
                    Conflicts
                  </div>
                  <div className="text-2xl font-black mt-1 text-rose-600">
                    {progress.overview.conflictAssignments}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Returned to chair</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reviewer Progress Table */}
          <Card className="border shadow-xs">
            <CardHeader className="p-5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Reviewer Workload & Progress</CardTitle>
                <CardDescription className="text-xs">
                  Reviewer completion rates, capacity load, and reminder actions.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50/70 dark:bg-slate-900/40 text-muted-foreground font-semibold">
                    <th className="p-3 pl-5">Reviewer</th>
                    <th className="p-3">Assigned / Max</th>
                    <th className="p-3">Completed</th>
                    <th className="p-3">Pending / Draft</th>
                    <th className="p-3">Progress</th>
                    <th className="p-3">Last Active</th>
                    <th className="p-3 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {progress?.reviewers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        No reviewers registered yet. Invite reviewers from the Reviewer Pool tab.
                      </td>
                    </tr>
                  ) : (
                    progress?.reviewers.map((r) => (
                      <tr key={r.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="p-3 pl-5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {r.fullName || "—"}
                          </div>
                          <div className="text-muted-foreground text-[11px]">{r.email}</div>
                          {r.institution && (
                            <div className="text-[10px] text-slate-500 italic mt-0.5">
                              {r.institution}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold">{r.assignedCount}</span>{" "}
                          <span className="text-muted-foreground">/ {r.maxLoad}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {r.completedCount}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {r.pendingCount} pending, {r.inProgressCount} draft
                        </td>
                        <td className="p-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{ width: `${r.percentComplete}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] w-9 text-right font-semibold">
                              {r.percentComplete}%
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground text-[11px]">
                          {r.lastReviewAt ? new Date(r.lastReviewAt).toLocaleDateString() : "Never"}
                        </td>
                        <td className="p-3 pr-5 text-right">
                          {r.pendingCount > 0 || r.inProgressCount > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRemindReviewerId(r.userId);
                                setRemindModalOpen(true);
                              }}
                              className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                              <Bell className="h-3.5 w-3.5 mr-1" />
                              Remind
                            </Button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-medium">Done</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Category Progress Table */}
          {progress && progress.categories.length > 0 && (
            <Card className="border shadow-xs">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-bold">Category & Track Completion</CardTitle>
                <CardDescription className="text-xs">
                  Review velocity by academic track.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50/70 dark:bg-slate-900/40 text-muted-foreground font-semibold">
                      <th className="p-3 pl-5">Category / Track</th>
                      <th className="p-3">Submissions</th>
                      <th className="p-3">Assignments</th>
                      <th className="p-3">Completed</th>
                      <th className="p-3 pr-5">Completion %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {progress.categories.map((c) => (
                      <tr key={c.categoryId} className="hover:bg-slate-50/50">
                        <td className="p-3 pl-5 font-semibold">{c.categoryName}</td>
                        <td className="p-3">{c.submissionCount}</td>
                        <td className="p-3">{c.assignedCount}</td>
                        <td className="p-3 text-emerald-600 font-medium">{c.completedCount}</td>
                        <td className="p-3 pr-5 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${c.percentComplete}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] w-9 text-right font-semibold">
                              {c.percentComplete}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── TAB 2: Reviewer Pool (REV-01, REV-02, REV-14) ─── */}
      {activeTab === "reviewers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Reviewer Pool</h2>
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
              Invite Reviewer
            </Button>
          </div>

          <Card className="border shadow-xs">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50/70 dark:bg-slate-900/40 text-muted-foreground font-semibold">
                    <th className="p-3 pl-5">Reviewer</th>
                    <th className="p-3">Institution</th>
                    <th className="p-3">Expertise Categories</th>
                    <th className="p-3">Max Load</th>
                    <th className="p-3">Invitation & Confidentiality</th>
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
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="p-3 pl-5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {r.fullName || "—"}
                          </div>
                          <div className="text-muted-foreground text-[11px]">{r.email}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{r.institution || "—"}</td>
                        <td className="p-3">
                          {r.categories && r.categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.categories.map((c) => (
                                <Badge key={c.id} variant="secondary" className="text-[10px]">
                                  {c.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">
                              General (all categories)
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-semibold">{r.maxLoad} abstracts</td>
                        <td className="p-3 space-y-1">
                          <div>
                            {r.invitationStatus === "ACCEPTED" ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
                                Accepted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-600">
                                Pending Invite
                              </Badge>
                            )}
                          </div>
                          {r.confidentialityAgreedAt ? (
                            <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
                              <ShieldCheck className="h-3 w-3" />
                              Confidentiality Signed
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
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
                            className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="View Certificate of Appreciation"
                          >
                            <Award className="h-3.5 w-3.5 mr-1" />
                            Certificate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveReviewer(r.id, r.fullName || r.email)}
                            className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
      {activeTab === "rubric" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Scoring Rubric Builder</h2>
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
              Add Rubric Criterion
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
                <Card key={c.id} className="border shadow-xs bg-white dark:bg-slate-900 flex flex-col justify-between">
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
                      <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Scale:
                      </span>
                      <div className="flex gap-1">
                        {Array.from(
                          { length: c.scaleMax - c.scaleMin + 1 },
                          (_, i) => c.scaleMin + i,
                        ).map((v) => (
                          <span
                            key={v}
                            className="px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-medium"
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
                      className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Review Assignments</h2>
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
                Manual Assign
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkCategoryModalOpen(true)}
                className="gap-1.5"
              >
                <Users className="h-4 w-4" />
                Bulk by Category
              </Button>
              <Button
                size="sm"
                onClick={() => setAutoAssignModalOpen(true)}
                className="gap-1.5 bg-primary text-primary-foreground font-semibold"
              >
                <Shuffle className="h-4 w-4" />
                Auto-Assign Engine
              </Button>
            </div>
          </div>

          <Card className="border shadow-xs">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50/70 dark:bg-slate-900/40 text-muted-foreground font-semibold">
                    <th className="p-3 pl-5">Abstract</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Reviewer</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Score & Outcome</th>
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
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="p-3 pl-5 max-w-[280px]">
                          <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {a.submission?.refNo || "—"}
                          </span>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
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
                            <div className="text-[10px] text-muted-foreground italic">
                              {a.reviewer.institution}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {a.status === "COMPLETED" ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
                              Completed
                            </Badge>
                          ) : a.status === "IN_PROGRESS" ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px]">
                              In Progress
                            </Badge>
                          ) : a.status === "CONFLICT" ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Conflict
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Pending
                            </Badge>
                          )}
                          {a.coiReason && (
                            <p className="text-[10px] text-rose-600 mt-1 italic">
                              Reason: {a.coiReason}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          {a.review && !a.review.isDraft ? (
                            <div className="space-y-0.5">
                              <Badge variant="outline" className="text-[10px]">
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
                            className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Reassign to another reviewer"
                          >
                            Reassign
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAssignment(a.id)}
                            className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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

      {/* ─── TAB 5: Score Table & Disagreement Board (REV-11, REV-12) ─── */}
      {activeTab === "scores" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Score Table & Disagreement Board</h2>
              <p className="text-xs text-muted-foreground">
                Ranked abstracts by weighted average score, individual reviewer marks, standard deviation, and dispute flags.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by Category"
                value={scoreCategoryFilter}
                onChange={(e) => setScoreCategoryFilter(e.target.value)}
                className="h-8 text-xs border rounded-lg px-2 bg-white dark:bg-slate-900"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Dispute Gap &ge;</span>
                <input
                  type="number"
                  aria-label="Dispute Gap Threshold"
                  step="0.5"
                  min="0.5"
                  max="10"
                  value={scoreDisagreementThreshold}
                  onChange={(e) => setScoreDisagreementThreshold(e.target.value)}
                  className="w-16 h-8 text-xs border rounded-lg px-2 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search ref or title..."
                  value={scoreSearch}
                  onChange={(e) => setScoreSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-44 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          <Card className="border shadow-xs">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50/70 dark:bg-slate-900/40 text-muted-foreground font-semibold">
                    <th className="p-3 pl-5 w-8">#</th>
                    <th className="p-3">Ref & Title</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Reviews</th>
                    <th className="p-3 text-center">Weighted Score</th>
                    <th className="p-3 text-center">Score Gap</th>
                    <th className="p-3 text-center">Std Dev</th>
                    <th className="p-3">Dispute Flag</th>
                    <th className="p-3 pr-5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {scoresTable.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        No evaluated abstracts found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    scoresTable.map((row, idx) => {
                      const isExpanded = Boolean(expandedSubmissions[row.submissionId]);
                      return (
                        <tr key={row.submissionId} className="group">
                          <td colSpan={9} className="p-0">
                            <div
                              onClick={() =>
                                setExpandedSubmissions((prev) => ({
                                  ...prev,
                                  [row.submissionId]: !prev[row.submissionId],
                                }))
                              }
                              className={`flex items-center p-3 pl-5 pr-5 cursor-pointer transition-colors ${
                                row.isDisputed
                                  ? "bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70"
                                  : "hover:bg-slate-50/60"
                              }`}
                            >
                              <div className="w-8 font-mono text-muted-foreground font-semibold">
                                {idx + 1}
                              </div>
                              <div className="flex-1 pr-4">
                                <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  {row.refNo || "—"}
                                </span>
                                <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                                  {row.title}
                                </div>
                              </div>
                              <div className="w-32 text-muted-foreground truncate">
                                {row.categoryName || "—"}
                              </div>
                              <div className="w-20 text-center font-semibold">
                                {row.completedReviewCount} / {row.assignedReviewCount}
                              </div>
                              <div className="w-24 text-center font-bold text-base text-slate-900 dark:text-slate-100">
                                {row.weightedAverageScore || "—"}
                              </div>
                              <div className="w-20 text-center font-mono">
                                {row.scoreGap > 0 ? row.scoreGap : "—"}
                              </div>
                              <div className="w-20 text-center font-mono text-muted-foreground">
                                &plusmn;{row.standardDeviation}
                              </div>
                              <div className="w-36">
                                {row.isDisputed ? (
                                  <Badge variant="destructive" className="text-[10px] gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Disputed Gap
                                  </Badge>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">Aligned</span>
                                )}
                              </div>
                              <div className="w-12 text-right">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
                                )}
                              </div>
                            </div>

                            {/* Expanded Breakdown */}
                            {isExpanded && (
                              <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 border-t border-b space-y-3">
                                {row.disputeReason && (
                                  <div className="p-2.5 rounded-lg bg-rose-100/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between">
                                    <span>
                                      <strong>Dispute Flag:</strong> {row.disputeReason}
                                    </span>
                                    {/* Action to add third reviewer (REV-13) */}
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setManualSubmissionId(row.submissionId);
                                        setManualReviewerId("");
                                        setManualAssignModalOpen(true);
                                      }}
                                      className="h-7 text-xs font-semibold"
                                    >
                                      + Add 3rd Reviewer
                                    </Button>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {row.reviews.length === 0 ? (
                                    <div className="col-span-2 text-muted-foreground text-xs italic py-2">
                                      No completed reviews submitted yet for this abstract.
                                    </div>
                                  ) : (
                                    row.reviews.map((rev, rIdx) => (
                                      <div
                                        key={rIdx}
                                        className="p-3 rounded-lg border bg-white dark:bg-slate-800 text-xs space-y-2"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold">
                                            {rev.reviewerName || `Reviewer ${rIdx + 1}`}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px]">
                                              {rev.recommendation?.replace(/_/g, " ")}
                                            </Badge>
                                            <span className="font-bold text-sm">
                                              Score: {rev.weightedScore}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Criterion scores */}
                                        <div className="grid grid-cols-2 gap-1 pt-1 border-t text-[11px]">
                                          {rev.criterionScores.map((c) => (
                                            <div key={c.criterionId} className="flex justify-between">
                                              <span className="text-muted-foreground truncate">
                                                {c.criterionName}:
                                              </span>
                                              <span className="font-semibold">{c.score}</span>
                                            </div>
                                          ))}
                                        </div>

                                        {rev.commentAuthor && (
                                          <div className="pt-1 text-[11px]">
                                            <strong className="text-muted-foreground">To Author:</strong>{" "}
                                            {rev.commentAuthor}
                                          </div>
                                        )}

                                        {rev.commentCommittee && (
                                          <div className="pt-1 text-[11px] text-amber-700 dark:text-amber-400">
                                            <strong>Confidential:</strong> {rev.commentCommittee}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── MODAL: Invite Reviewer (REV-01) ─── */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Peer Reviewer</DialogTitle>
            <DialogDescription>
              Invite a senior consultant or reviewer by email, record their expertise tracks, and set max workload capacity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rev-email">Reviewer Email *</Label>
              <Input
                id="rev-email"
                placeholder="reviewer@hospital.org"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-name">Full Name (optional)</Label>
              <Input
                id="rev-name"
                placeholder="Prof. / Dr. ..."
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expertise Categories</Label>
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
                      className="rounded border-gray-300 text-primary"
                    />
                    <span className="truncate">{cat.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Leave unchecked if reviewer can evaluate submissions in all categories.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-max">Max Capacity Load</Label>
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
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Rubric Criterion (REV-04) ─── */}
      <Dialog open={criterionModalOpen} onOpenChange={setCriterionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCriterionId ? "Edit Scoring Criterion" : "Add Rubric Scoring Criterion"}
            </DialogTitle>
            <DialogDescription>
              Define scoring criteria, numeric scale bounds, and formula weight.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="crit-name">Criterion Name *</Label>
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
                <Label htmlFor="crit-min">Min Scale</Label>
                <Input
                  id="crit-min"
                  type="number"
                  value={criterionScaleMin}
                  onChange={(e) => setCriterionScaleMin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crit-max">Max Scale</Label>
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
              Save Criterion
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
              Automated Reviewer Assignment
            </DialogTitle>
            <DialogDescription>
              Automatically assign peer reviewers to submitted abstracts balancing reviewer workload, matching category expertise, and avoiding institutional conflicts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="auto-count">Reviewers per Abstract</Label>
              <Input
                id="auto-count"
                type="number"
                min="1"
                max="10"
                value={autoReviewersPerAbstract}
                onChange={(e) => setAutoReviewersPerAbstract(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Standard default is 2 reviewers per submission.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auto-cat">Target Category (optional)</Label>
              <select
                id="auto-cat"
                value={autoCategory}
                onChange={(e) => setAutoCategory(e.target.value)}
                className="w-full h-9 text-xs border rounded-lg px-2 bg-white dark:bg-slate-900"
              >
                <option value="">All Categories</option>
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
                  className="rounded border-gray-300 text-primary"
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
                  className="rounded border-gray-300 text-primary"
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
              Run Auto-Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Bulk Category Assign (REV-06) ─── */}
      <Dialog open={bulkCategoryModalOpen} onOpenChange={setBulkCategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign by Category</DialogTitle>
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
                className="w-full h-9 text-xs border rounded-lg px-2 bg-white dark:bg-slate-900"
              >
                <option value="">Select Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Select Reviewers *</Label>
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
                      className="rounded border-gray-300 text-primary"
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
              Assign Reviewers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Manual Assign ─── */}
      <Dialog open={manualAssignModalOpen} onOpenChange={setManualAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Reviewer Assignment</DialogTitle>
            <DialogDescription>
              Assign or add a reviewer to a specific submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Select Submission *</Label>
              <select
                value={manualSubmissionId}
                onChange={(e) => setManualSubmissionId(e.target.value)}
                className="w-full h-9 text-xs border rounded-lg px-2 bg-white dark:bg-slate-900"
              >
                <option value="">Select Submission...</option>
                {submissionsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.refNo ? `[${s.refNo}] ` : ""}
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Select Reviewer *</Label>
              <select
                value={manualReviewerId}
                onChange={(e) => setManualReviewerId(e.target.value)}
                className="w-full h-9 text-xs border rounded-lg px-2 bg-white dark:bg-slate-900"
              >
                <option value="">Select Reviewer...</option>
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
              Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Reassign (REV-13) ─── */}
      <Dialog open={reassignModalOpen} onOpenChange={setReassignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Reviewer</DialogTitle>
            <DialogDescription>
              Transfer this assignment to a new reviewer. Any prior draft will be cleared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>New Reviewer *</Label>
              <select
                value={reassignNewReviewerId}
                onChange={(e) => setReassignNewReviewerId(e.target.value)}
                className="w-full h-9 text-xs border rounded-lg px-2 bg-white dark:bg-slate-900"
              >
                <option value="">Select New Reviewer...</option>
                {reviewers.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.fullName || r.email} ({r.assignedCount}/{r.maxLoad} load)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Reason for Reassignment</Label>
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
              <Bell className="h-5 w-5 text-amber-500" />
              Send Review Reminders
            </DialogTitle>
            <DialogDescription>
              {remindReviewerId
                ? "Send an immediate reminder notification to this reviewer regarding their pending reviews."
                : "Send an automatic reminder to ALL reviewers who currently have pending or in-progress assignments."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="remind-msg">Custom Note (optional)</Label>
              <Textarea
                id="remind-msg"
                placeholder="Add an urgent note or deadline reminder from the academic committee..."
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
              Send Reminders
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
    </div>
  );
}
