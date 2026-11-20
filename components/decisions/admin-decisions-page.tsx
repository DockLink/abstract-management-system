"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/shared/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { PageSkeleton } from "@/components/shared/skeletons";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { DecisionBoardRow, DecisionBoardSummary } from "@/lib/services/decisions/board";
import type { CutoffsResult } from "@/lib/services/decisions/cutoffs";
import type { DecisionSettings } from "@/lib/validators/decisions";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Gavel,
  Loader2,
  Mail,
  Printer,
  RefreshCw,
  Scale,
  Send,
  Sliders,
  UserCheck,
  XCircle,
} from "lucide-react";

interface Props {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
}

interface EmailTemplateItem {
  key: string;
  label: string;
  subject: string;
  body: string;
  isCustomized: boolean;
  updatedAt: string | null;
}

const OUTCOME_LABEL: Record<string, string> = {
  ACCEPT_ORAL: "Accept Oral",
  ACCEPT_POSTER: "Accept Poster",
  REJECT: "Reject",
  REVISIONS_REQUESTED: "Revisions Requested",
  WAITLIST: "Waitlist",
};

export function AdminDecisionsPage({ orgId, eventId, orgSlug, eventSlug }: Props) {
  const [activeTab, setActiveTab] = useState<"board" | "cutoffs" | "release" | "templates" | "exports">("board");

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DecisionBoardRow[]>([]);
  const [summary, setSummary] = useState<DecisionBoardSummary | null>(null);
  const [settings, setSettings] = useState<DecisionSettings | null>(null);
  const [canDecide, setCanDecide] = useState(true);
  const [isAdmin, setIsAdmin] = useState(true);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter states
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [viewFilter, setViewFilter] = useState<"all" | "pending_release" | "unregistered" | "declined" | "disputed">("all");

  // SidePanel inspection & single decision
  const [panelRow, setPanelRow] = useState<DecisionBoardRow | null>(null);
  const [panelDecision, setPanelDecision] = useState<string>("NONE");
  const [panelNote, setPanelNote] = useState("");
  const [savingPanel, setSavingPanel] = useState(false);

  // Bulk decision modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDecision, setBulkDecision] = useState<string>("ACCEPT_ORAL");
  const [bulkNote, setBulkNote] = useState("");
  const [savingBulk, setSavingBulk] = useState(false);

  // Cut-offs tab states
  const [cutoffsMode, setCutoffsMode] = useState<"preview" | "apply">("preview");
  const [cutoffCategory, setCutoffCategory] = useState("all");
  const [cutoffResult, setCutoffResult] = useState<CutoffsResult | null>(null);
  const [evaluatingCutoffs, setEvaluatingCutoffs] = useState(false);
  const [applyCutoffsConfirmOpen, setApplyCutoffsConfirmOpen] = useState(false);

  // Cut-off editable settings
  const [oralScore, setOralScore] = useState<string>("7.0");
  const [posterScore, setPosterScore] = useState<string>("5.0");
  const [belowAction, setBelowAction] = useState<"NONE" | "WAITLIST" | "REJECT">("NONE");
  const [minReviews, setMinReviews] = useState<number>(1);
  const [skipDisputed, setSkipDisputed] = useState(true);
  const [disagreementThreshold, setDisagreementThreshold] = useState<number>(2.0);
  const [savingSettings, setSavingSettings] = useState(false);

  // Release tab states
  const [releaseCategory, setReleaseCategory] = useState("all");
  const [includeComments, setIncludeComments] = useState(false);
  const [revisionDue, setRevisionDue] = useState("");
  const [sendEmails, setSendEmails] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);

  // Templates tab states
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("decision.accept_oral");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Waitlist offer modal
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [declinedRow, setDeclinedRow] = useState<DecisionBoardRow | null>(null);
  const [selectedWaitlistedId, setSelectedWaitlistedId] = useState<string>("");
  const [submittingOffer, setSubmittingOffer] = useState(false);

  // Abstract Book export options
  const [includeAcceptedInBook, setIncludeAcceptedInBook] = useState(false);

  // ─── Fetch Categories ───
  const loadCategories = useCallback(async () => {
    try {
      const res = await apiFetch<Array<{ id: string; name: string }>>(
        `/api/v1/orgs/${orgId}/events/${eventId}/categories`,
      );
      if (res.ok) setCategories(res.data);
    } catch (e) {
      console.error("Failed to load categories", e);
    }
  }, [orgId, eventId]);

  // ─── Fetch Board Data ───
  const loadBoard = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (decisionFilter !== "all") params.set("decision", decisionFilter);
      if (search.trim()) params.set("search", search.trim());
      if (viewFilter === "disputed") {
        params.set("disputedOnly", "true");
      } else if (viewFilter !== "all") {
        params.set("view", viewFilter);
      }

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const res = await apiFetch<{
        rows: DecisionBoardRow[];
        summary: DecisionBoardSummary;
        settings: DecisionSettings;
        canDecide: boolean;
        isAdmin: boolean;
      }>(`/api/v1/orgs/${orgId}/events/${eventId}/decisions/board${queryStr}`);

      if (res.ok) {
        setRows(res.data.rows);
        setSummary(res.data.summary);
        setSettings(res.data.settings);
        setCanDecide(res.data.canDecide);
        setIsAdmin(res.data.isAdmin);

        // Populate settings inputs
        if (res.data.settings) {
          setOralScore(res.data.settings.oralMinScore != null ? String(res.data.settings.oralMinScore) : "7.0");
          setPosterScore(res.data.settings.posterMinScore != null ? String(res.data.settings.posterMinScore) : "5.0");
          setBelowAction(res.data.settings.belowCutoff || "NONE");
          setMinReviews(res.data.settings.minCompletedReviews || 1);
          setSkipDisputed(res.data.settings.skipDisputed ?? true);
          setDisagreementThreshold(res.data.settings.disagreementThreshold || 2.0);
        }
      } else {
        setError(res.error.message || "Failed to load decision board");
      }
    } catch (err) {
      console.error("Failed to load decision board", err);
      setError(err instanceof Error ? err.message : "Failed to load decision board");
    } finally {
      setLoading(false);
    }
  }, [orgId, eventId, categoryFilter, decisionFilter, viewFilter, search]);

  // ─── Fetch Templates ───
  const loadTemplates = useCallback(async () => {
    try {
      const res = await apiFetch<EmailTemplateItem[]>(
        `/api/v1/orgs/${orgId}/events/${eventId}/decisions/email-templates`,
      );
      if (res.ok) {
        setTemplates(res.data);
        const current = res.data.find((t) => t.key === selectedTemplateKey) || res.data[0];
        if (current) {
          setSelectedTemplateKey(current.key);
          setTemplateSubject(current.subject);
          setTemplateBody(current.body);
        }
      }
    } catch (e) {
      console.error("Failed to load templates", e);
    }
  }, [orgId, eventId, selectedTemplateKey]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await loadCategories();
      if (active) await loadBoard(false);
    })();
    return () => {
      active = false;
    };
  }, [loadCategories, loadBoard]);

  useEffect(() => {
    let active = true;
    if (activeTab === "templates") {
      void (async () => {
        if (active) await loadTemplates();
      })();
    }
    return () => {
      active = false;
    };
  }, [activeTab, loadTemplates]);

  // ─── Handle Selection ───
  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ─── Save Single Decision from SidePanel ───
  const handleSavePanelDecision = async () => {
    if (!panelRow) return;
    try {
      setSavingPanel(true);
      const decValue = panelDecision === "NONE" ? null : panelDecision;
      const res = await apiFetch(`/api/v1/orgs/${orgId}/events/${eventId}/decisions`, {
        method: "POST",
        body: {
          submissionIds: [panelRow.id],
          decision: decValue,
          note: panelNote.trim() || undefined,
        },
      });
      if (!res.ok) throw new Error(res.error.message);
      toast.success(canDecide ? "Decision saved" : "Recommendation recorded");
      setPanelRow(null);
      void loadBoard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save decision");
    } finally {
      setSavingPanel(false);
    }
  };

  // ─── Save Bulk Decisions ───
  const handleSaveBulkDecision = async () => {
    if (selectedIds.size === 0) return;
    try {
      setSavingBulk(true);
      const decValue = bulkDecision === "NONE" ? null : bulkDecision;
      const res = await apiFetch<{ updatedCount: number; isRecommendationOnly: boolean }>(
        `/api/v1/orgs/${orgId}/events/${eventId}/decisions`,
        {
          method: "POST",
          body: {
            submissionIds: Array.from(selectedIds),
            decision: decValue,
            note: bulkNote.trim() || undefined,
          },
        },
      );
      if (!res.ok) throw new Error(res.error.message);
      toast.success(
        res.data.isRecommendationOnly
          ? `Recorded recommendation for ${res.data.updatedCount} abstracts`
          : `Applied decision to ${res.data.updatedCount} abstracts`,
      );
      setBulkModalOpen(false);
      setSelectedIds(new Set());
      void loadBoard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply bulk decision");
    } finally {
      setSavingBulk(false);
    }
  };

  // ─── Save Cut-off Settings ───
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const res = await apiFetch(`/api/v1/orgs/${orgId}/events/${eventId}/decisions/settings`, {
        method: "PATCH",
        body: {
          oralMinScore: oralScore ? Number(oralScore) : null,
          posterMinScore: posterScore ? Number(posterScore) : null,
          belowCutoff: belowAction,
          minCompletedReviews: minReviews,
          skipDisputed,
          disagreementThreshold,
        },
      });
      if (!res.ok) throw new Error(res.error.message);
      toast.success("Cut-off settings saved");
      void loadBoard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // ─── Evaluate Cut-offs (Preview / Apply) ───
  const handleEvaluateCutoffs = async (mode: "preview" | "apply") => {
    try {
      setEvaluatingCutoffs(true);
      const res = await apiFetch<CutoffsResult>(
        `/api/v1/orgs/${orgId}/events/${eventId}/decisions/cutoffs`,
        {
          method: "POST",
          body: {
            mode,
            categoryId: cutoffCategory !== "all" ? cutoffCategory : undefined,
          },
        },
      );
      if (res.ok) {
        setCutoffResult(res.data);
        if (mode === "apply") {
          toast.success("Provisional cut-off decisions applied successfully");
          setApplyCutoffsConfirmOpen(false);
          void loadBoard();
        }
      } else {
        toast.error(res.error.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to evaluate cut-offs");
    } finally {
      setEvaluatingCutoffs(false);
    }
  };

  // ─── Release Decisions ───
  const handleRelease = async () => {
    try {
      setReleasing(true);
      const res = await apiFetch<{ releasedCount: number; emailsQueued: number }>(
        `/api/v1/orgs/${orgId}/events/${eventId}/decisions/release`,
        {
          method: "POST",
          body: {
            categoryId: releaseCategory !== "all" ? releaseCategory : undefined,
            includeReviewerComments: includeComments,
            revisionDueAt: revisionDue ? new Date(revisionDue).toISOString() : undefined,
            sendEmails,
          },
        },
      );
      if (res.ok) {
        toast.success(
          `Released ${res.data.releasedCount} decisions${sendEmails ? ` (${res.data.emailsQueued} emails queued)` : ""}`,
        );
        setReleaseConfirmOpen(false);
        void loadBoard();
      } else {
        toast.error(res.error.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to release decisions");
    } finally {
      setReleasing(false);
    }
  };

  // ─── Save Email Template ───
  const handleSaveTemplate = async () => {
    if (!selectedTemplateKey) return;
    try {
      setSavingTemplate(true);
      const res = await apiFetch(
        `/api/v1/orgs/${orgId}/events/${eventId}/decisions/email-templates/${encodeURIComponent(selectedTemplateKey)}`,
        {
          method: "PUT",
          body: {
            key: selectedTemplateKey,
            subject: templateSubject,
            body: templateBody,
          },
        },
      );
      if (!res.ok) throw new Error(res.error.message);
      toast.success("Template saved");
      void loadTemplates();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  // ─── Offer Waitlist Slot ───
  const handleOfferWaitlist = async () => {
    if (!declinedRow || !selectedWaitlistedId) return;
    try {
      setSubmittingOffer(true);
      const res = await apiFetch(
        `/api/v1/orgs/${orgId}/events/${eventId}/decisions/confirmations?waitlistedId=${encodeURIComponent(selectedWaitlistedId)}`,
        {
          method: "POST",
          body: {
            action: "offer_waitlist",
            declinedSubmissionId: declinedRow.id,
            sendEmail: true,
          },
        },
      );
      if (!res.ok) throw new Error(res.error.message);
      toast.success("Slot offered to waitlisted author");
      setOfferModalOpen(false);
      setDeclinedRow(null);
      void loadBoard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to offer slot");
    } finally {
      setSubmittingOffer(false);
    }
  };

  const waitlistedRows = rows.filter((r) => r.status === "WAITLISTED");

  // Count pending release within releaseCategory
  const pendingInReleaseCategory = rows.filter((r) => {
    if (!r.isPendingRelease) return false;
    if (releaseCategory !== "all" && r.categoryId !== releaseCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Decisions & Notifications"
        description="Rank submissions by peer-review score, set cut-offs, record decisions in bulk, and release notification emails to authors."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadBoard()}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            {summary && summary.pendingRelease > 0 && isAdmin && (
              <Button
                size="sm"
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => setActiveTab("release")}
              >
                <Send className="h-4 w-4" />
                Release {summary.pendingRelease} Pending
              </Button>
            )}
          </div>
        }
      />

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Total Submissions"
            value={summary.total}
            hint={`${summary.decidable} decidable`}
          />
          <StatCard
            label="Pending Release"
            value={summary.pendingRelease}
            hint="Hidden from authors"
            tone={summary.pendingRelease > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Accepted (Oral)"
            value={summary.acceptedOral}
            hint="Oral presentation"
            tone="success"
          />
          <StatCard
            label="Accepted (Poster)"
            value={summary.acceptedPoster}
            hint="Poster presentation"
            tone="default"
          />
          <StatCard
            label="Disputed"
            value={summary.disputed}
            hint="Reviewers disagree"
            tone={summary.disputed > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Unregistered"
            value={summary.unregistered}
            hint="Accepted authors"
            tone={summary.unregistered > 0 ? "danger" : "default"}
          />
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 md:w-auto">
          <TabsTrigger value="board" className="gap-2">
            <Gavel className="h-4 w-4" />
            <span className="hidden sm:inline">Decision Board</span>
            <span className="sm:hidden">Board</span>
          </TabsTrigger>
          <TabsTrigger value="cutoffs" className="gap-2">
            <Sliders className="h-4 w-4" />
            <span className="hidden sm:inline">Cut-offs</span>
            <span className="sm:hidden">Cutoffs</span>
          </TabsTrigger>
          <TabsTrigger value="release" className="gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Release</span>
            <span className="sm:hidden">Release</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email Templates</span>
            <span className="sm:hidden">Emails</span>
          </TabsTrigger>
          <TabsTrigger value="exports" className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exports & Books</span>
            <span className="sm:hidden">Exports</span>
          </TabsTrigger>
        </TabsList>

        {/* ────────────────── TAB 1: DECISION BOARD ────────────────── */}
        <TabsContent value="board" className="space-y-4">
          {/* Filter Bar & Quick Views */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={viewFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewFilter("all")}
                  >
                    All ({summary?.total ?? 0})
                  </Button>
                  <Button
                    variant={viewFilter === "pending_release" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewFilter("pending_release")}
                    className="gap-1.5"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Pending Release ({summary?.pendingRelease ?? 0})
                  </Button>
                  <Button
                    variant={viewFilter === "disputed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewFilter("disputed")}
                    className="gap-1.5 text-amber-600 dark:text-amber-400"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Disputed ({summary?.disputed ?? 0})
                  </Button>
                  <Button
                    variant={viewFilter === "unregistered" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewFilter("unregistered")}
                    className="gap-1.5"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Unregistered ({summary?.unregistered ?? 0})
                  </Button>
                  <Button
                    variant={viewFilter === "declined" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewFilter("declined")}
                    className="gap-1.5 text-red-600 dark:text-red-400"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Declined Slots ({summary?.declined ?? 0})
                  </Button>
                </div>

                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/50 p-1.5 px-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      {selectedIds.size} selected
                    </span>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => setBulkModalOpen(true)}
                    >
                      <Gavel className="h-3.5 w-3.5" />
                      Set Decision
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Input
                    placeholder="Search by title or reference..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={decisionFilter} onValueChange={setDecisionFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Decisions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Decisions</SelectItem>
                      <SelectItem value="NONE">No Decision (Pending)</SelectItem>
                      <SelectItem value="ACCEPT_ORAL">Accept Oral</SelectItem>
                      <SelectItem value="ACCEPT_POSTER">Accept Poster</SelectItem>
                      <SelectItem value="REJECT">Reject</SelectItem>
                      <SelectItem value="REVISIONS_REQUESTED">Revisions Requested</SelectItem>
                      <SelectItem value="WAITLIST">Waitlist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {loading ? (
            <PageSkeleton />
          ) : error ? (
            <ErrorState title="Failed to load decision board" description={error} onRetry={() => void loadBoard()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Gavel}
              title="No submissions found"
              description="No submissions match the current filters or query."
              action={
                <Button variant="outline" size="sm" onClick={() => { setSearch(""); setCategoryFilter("all"); setDecisionFilter("all"); setViewFilter("all"); }}>
                  Reset Filters
                </Button>
              }
            />
          ) : (
            <div className="rounded-md border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 text-center w-10">
                        <Checkbox
                          checked={selectedIds.size === rows.length && rows.length > 0}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </th>
                      <th className="p-3 text-left">Ref & Title</th>
                      <th className="p-3 text-left hidden md:table-cell">Category</th>
                      <th className="p-3 text-center">Score & Reviews</th>
                      <th className="p-3 text-left hidden lg:table-cell">Recommendation</th>
                      <th className="p-3 text-left">Current Decision</th>
                      <th className="p-3 text-left hidden sm:table-cell">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row, idx) => {
                      const isSelected = selectedIds.has(row.id);
                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "hover:bg-muted/30 transition-colors",
                            isSelected && "bg-indigo-50/50 dark:bg-indigo-950/20",
                          )}
                        >
                          <td className="p-3 text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectRow(row.id)}
                              aria-label={`Select ${row.refNo || row.title}`}
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>#{idx + 1}</span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {row.refNo || "---"}
                              </span>
                              {row.scoreStats.isDisputed && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-[10px] px-1.5 py-0">
                                  Disputed
                                </Badge>
                              )}
                              {row.isPendingRelease && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                  Pending Release
                                </Badge>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setPanelRow(row);
                                setPanelDecision(row.decision || "NONE");
                                setPanelNote(row.decisionNote || "");
                              }}
                              className="text-left font-medium text-foreground hover:text-indigo-600 line-clamp-1 mt-0.5"
                            >
                              {row.title}
                            </button>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {row.presentingAuthor?.name || row.submitter.fullName || row.submitter.email}
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">
                            {row.categoryName || "Unassigned"}
                          </td>
                          <td className="p-3 text-center">
                            <div className="font-bold text-base text-foreground">
                              {row.scoreStats.weightedAverageScore > 0
                                ? row.scoreStats.weightedAverageScore.toFixed(2)
                                : "—"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {row.scoreStats.completedReviews} revs
                              {row.scoreStats.standardDeviation > 0 && ` (±${row.scoreStats.standardDeviation.toFixed(1)})`}
                            </div>
                          </td>
                          <td className="p-3 hidden lg:table-cell text-xs">
                            {row.chairRecommendation ? (
                              <Badge variant="outline">
                                {OUTCOME_LABEL[row.chairRecommendation] || row.chairRecommendation}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            {row.decision ? (
                              <div className="space-y-1">
                                <Badge
                                  className={cn(
                                    row.decision === "ACCEPT_ORAL" && "bg-emerald-600 text-white",
                                    row.decision === "ACCEPT_POSTER" && "bg-teal-600 text-white",
                                    row.decision === "REJECT" && "bg-rose-600 text-white",
                                    row.decision === "REVISIONS_REQUESTED" && "bg-amber-600 text-white",
                                    row.decision === "WAITLIST" && "bg-purple-600 text-white",
                                  )}
                                >
                                  {OUTCOME_LABEL[row.decision] || row.decision}
                                </Badge>
                                {row.decisionSource === "CUTOFF" && (
                                  <div className="text-[10px] text-muted-foreground">
                                    via Cut-off
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">None</span>
                            )}
                          </td>
                          <td className="p-3 hidden sm:table-cell">
                            <StatusBadge status={row.status} />
                            {row.slotResponse === "DECLINED" && (
                              <div className="text-[10px] text-red-600 dark:text-red-400 font-semibold mt-0.5">
                                Slot Declined
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {row.slotResponse === "DECLINED" && isAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2 text-xs text-indigo-600"
                                  onClick={() => {
                                    setDeclinedRow(row);
                                    setSelectedWaitlistedId("");
                                    setOfferModalOpen(true);
                                  }}
                                >
                                  Offer Slot
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2.5 text-xs"
                                onClick={() => {
                                  setPanelRow(row);
                                  setPanelDecision(row.decision || "NONE");
                                  setPanelNote(row.decisionNote || "");
                                }}
                              >
                                Review & Decide &rarr;
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ────────────────── TAB 2: CUT-OFFS ────────────────── */}
        <TabsContent value="cutoffs" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cut-off Settings Card */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                  Cut-off Rules & Thresholds
                </CardTitle>
                <CardDescription>
                  Configure score benchmarks for provisional decisions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="oralScore">Oral Presentation Cut-off (Score ≥)</Label>
                  <Input
                    id="oralScore"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={oralScore}
                    onChange={(e) => setOralScore(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Abstracts with score ≥ this will be provisionally accepted for Oral.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="posterScore">Poster Presentation Cut-off (Score ≥)</Label>
                  <Input
                    id="posterScore"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={posterScore}
                    onChange={(e) => setPosterScore(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Abstracts with score between poster and oral cut-offs will be Poster.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="belowAction">Below Poster Cut-off Action</Label>
                  <Select value={belowAction} onValueChange={(v) => setBelowAction(v as typeof belowAction)}>
                    <SelectTrigger id="belowAction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Leave Undecided</SelectItem>
                      <SelectItem value="WAITLIST">Set as Waitlist</SelectItem>
                      <SelectItem value="REJECT">Set as Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minReviews">Min Completed Reviews</Label>
                  <Input
                    id="minReviews"
                    type="number"
                    min="1"
                    max="10"
                    value={minReviews}
                    onChange={(e) => setMinReviews(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Skip abstracts with fewer completed reviews than this.
                  </p>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="skipDisputed"
                    checked={skipDisputed}
                    onCheckedChange={(c) => setSkipDisputed(!!c)}
                  />
                  <Label htmlFor="skipDisputed" className="text-xs font-medium cursor-pointer">
                    Skip disputed abstracts (score gap ≥ {disagreementThreshold})
                  </Label>
                </div>

                <div className="space-y-2 pt-2">
                  <Label htmlFor="disputeThreshold">Disagreement Threshold Gap</Label>
                  <Input
                    id="disputeThreshold"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={disagreementThreshold}
                    onChange={(e) => setDisagreementThreshold(Number(e.target.value))}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t pt-4">
                <Button
                  size="sm"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                >
                  {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Save Rules
                </Button>
              </CardFooter>
            </Card>

            {/* Cut-off Preview / Evaluation Card */}
            <Card className="md:col-span-2 space-y-4">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Evaluate & Apply Cut-offs</CardTitle>
                    <CardDescription>
                      Preview the provisional decisions before applying them to the board.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={cutoffCategory} onValueChange={setCutoffCategory}>
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue placeholder="Scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tracks</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEvaluateCutoffs("preview")}
                      disabled={evaluatingCutoffs}
                      className="gap-1.5"
                    >
                      {evaluatingCutoffs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                      Preview
                    </Button>
                    {cutoffResult && cutoffResult.changes.length > 0 && (
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                        onClick={() => setApplyCutoffsConfirmOpen(true)}
                        disabled={evaluatingCutoffs}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Apply Cut-offs
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {cutoffResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 rounded-lg">
                        <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          Oral Assigned
                        </div>
                        <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                          {cutoffResult.summary.oralAssigned}
                        </div>
                      </div>
                      <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 p-3 rounded-lg">
                        <div className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                          Poster Assigned
                        </div>
                        <div className="text-2xl font-bold text-teal-900 dark:text-teal-100">
                          {cutoffResult.summary.posterAssigned}
                        </div>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                        <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          Skipped (Reviews/Dispute)
                        </div>
                        <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                          {cutoffResult.summary.skippedReviews + cutoffResult.summary.skippedDisputed}
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900 border p-3 rounded-lg">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Evaluated Total
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {cutoffResult.summary.totalEvaluated}
                        </div>
                      </div>
                    </div>

                    <div className="rounded border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60 border-b font-semibold">
                          <tr>
                            <th className="p-2.5 text-left">Ref & Title</th>
                            <th className="p-2.5 text-center">Score</th>
                            <th className="p-2.5 text-center">Revs</th>
                            <th className="p-2.5 text-left">Provisional Action</th>
                            <th className="p-2.5 text-left">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {cutoffResult.changes.slice(0, 50).map((ch) => (
                            <tr key={ch.submissionId} className="hover:bg-muted/20">
                              <td className="p-2.5">
                                <span className="font-mono font-semibold">{ch.refNo || "---"}: </span>
                                <span className="font-medium">{ch.title}</span>
                              </td>
                              <td className="p-2.5 text-center font-bold">
                                {ch.score.toFixed(2)}
                              </td>
                              <td className="p-2.5 text-center">{ch.reviewCount}</td>
                              <td className="p-2.5">
                                {ch.provisionalDecision ? (
                                  <Badge
                                    className={cn(
                                      ch.provisionalDecision === "ACCEPT_ORAL" && "bg-emerald-600 text-white",
                                      ch.provisionalDecision === "ACCEPT_POSTER" && "bg-teal-600 text-white",
                                      ch.provisionalDecision === "WAITLIST" && "bg-purple-600 text-white",
                                      ch.provisionalDecision === "REJECT" && "bg-rose-600 text-white",
                                    )}
                                  >
                                    {OUTCOME_LABEL[ch.provisionalDecision]}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground italic">Skipped</span>
                                )}
                              </td>
                              <td className="p-2.5 text-muted-foreground">
                                {ch.skipReason || "Ready to apply"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-muted-foreground">
                    Click <strong>Preview</strong> above to evaluate current abstracts against the configured rules.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ────────────────── TAB 3: RELEASE ────────────────── */}
        <TabsContent value="release" className="space-y-6">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-indigo-600" />
                Release Decisions to Authors
              </CardTitle>
              <CardDescription>
                Decisions stay hidden until released. Releasing changes submission statuses, exposes decisions to authors, and queues email notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="releaseCategory">Release Scope</Label>
                <Select value={releaseCategory} onValueChange={setReleaseCategory}>
                  <SelectTrigger id="releaseCategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Entire Event (All Tracks)</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  You can release all decisions in one send, or release track by track.
                </p>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                    {pendingInReleaseCategory.length} Abstracts Ready for Release
                  </div>
                  <div className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">
                    in {releaseCategory === "all" ? "the whole event" : categories.find((c) => c.id === releaseCategory)?.name}
                  </div>
                </div>
                <Badge variant="outline" className="text-indigo-700 border-indigo-400 font-mono text-sm">
                  {pendingInReleaseCategory.length} pending
                </Badge>
              </div>

              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeComments"
                    checked={includeComments}
                    onCheckedChange={(c) => setIncludeComments(!!c)}
                  />
                  <Label htmlFor="includeComments" className="text-sm font-medium cursor-pointer">
                    Include anonymized reviewer comments in notification & author portal (DEC-06)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Only author comments are shared. Confidential committee comments remain strictly private.
                </p>

                <div className="space-y-2 pt-2">
                  <Label htmlFor="revisionDue">Revision Deadline (for Revisions Requested) (DEC-07)</Label>
                  <Input
                    id="revisionDue"
                    type="date"
                    value={revisionDue}
                    onChange={(e) => setRevisionDue(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Authors asked to revise will have until this date to update their submission.
                  </p>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="sendEmails"
                    checked={sendEmails}
                    onCheckedChange={(c) => setSendEmails(!!c)}
                  />
                  <Label htmlFor="sendEmails" className="text-sm font-medium cursor-pointer">
                    Queue and send decision emails to presenting authors immediately (DEC-05)
                  </Label>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-4">
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                disabled={pendingInReleaseCategory.length === 0}
                onClick={() => setReleaseConfirmOpen(true)}
              >
                <Send className="h-4 w-4" />
                Release Decisions ({pendingInReleaseCategory.length})
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ────────────────── TAB 4: EMAIL TEMPLATES ────────────────── */}
        <TabsContent value="templates" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Decision Templates</CardTitle>
                <CardDescription>Select an outcome template to edit.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {templates.map((tpl) => (
                  <button
                    key={tpl.key}
                    onClick={() => {
                      setSelectedTemplateKey(tpl.key);
                      setTemplateSubject(tpl.subject);
                      setTemplateBody(tpl.body);
                    }}
                    className={cn(
                      "w-full text-left p-3 rounded-md border text-sm transition-colors",
                      selectedTemplateKey === tpl.key
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 font-semibold text-indigo-900 dark:text-indigo-200"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{tpl.label}</span>
                      {tpl.isCustomized && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-emerald-600">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-normal truncate mt-1">
                      {tpl.subject}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Edit: {templates.find((t) => t.key === selectedTemplateKey)?.label}
                  </CardTitle>
                  <Button size="sm" onClick={handleSaveTemplate} disabled={savingTemplate}>
                    {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Save Template
                  </Button>
                </div>
                <CardDescription>
                  Merge variables: {"{author_name}"}, {"{abstract_title}"}, {"{ref_no}"}, {"{presentation_type}"}, {"{event_name}"}, {"{registration_url}"}, {"{deadline}"}, {"{reviewer_comments}"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tplSubject">Subject</Label>
                  <Input
                    id="tplSubject"
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tplBody">Email Body</Label>
                  <Textarea
                    id="tplBody"
                    rows={12}
                    value={templateBody}
                    onChange={(e) => setTemplateBody(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ────────────────── TAB 5: EXPORTS & ABSTRACT BOOK ────────────────── */}
        <TabsContent value="exports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Abstract Book Card (DEC-10) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-teal-600" />
                  Abstract Book (Word & PDF)
                </CardTitle>
                <CardDescription>
                  Generates the official symposium abstract book with cover page, category table of contents, underlined presenting authors, superscript affiliations, and structured sections.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeAccepted"
                    checked={includeAcceptedInBook}
                    onCheckedChange={(c) => setIncludeAcceptedInBook(!!c)}
                  />
                  <Label htmlFor="includeAccepted" className="text-sm font-medium cursor-pointer">
                    Include both Confirmed and Accepted abstracts (Default: Confirmed only)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Standard college policy only prints confirmed abstracts whose presenting authors have completed registration.
                </p>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  asChild
                  className="bg-teal-700 hover:bg-teal-800 text-white gap-1.5"
                >
                  <a
                    href={`/api/v1/orgs/${orgId}/events/${eventId}/decisions/export/abstract-book?format=docx&includeAccepted=${includeAcceptedInBook}`}
                    download
                  >
                    <Download className="h-4 w-4" />
                    Download Word (.docx)
                  </a>
                </Button>
                <Button asChild variant="outline" className="gap-1.5">
                  <a
                    href={`/api/v1/orgs/${orgId}/events/${eventId}/decisions/export/abstract-book?format=html&includeAccepted=${includeAcceptedInBook}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Printer className="h-4 w-4" />
                    Print / Save as PDF
                  </a>
                </Button>
              </CardFooter>
            </Card>

            {/* Excel Spreadsheet Card (DEC-11) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  Submissions & Decisions Spreadsheet
                </CardTitle>
                <CardDescription>
                  Full Excel export of all submissions with author rosters, affiliation numbers, reviewer scores, standard deviations, disagreement flags, decisions, and registration statuses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1">
                  <div><strong>Columns included:</strong> Reference #, Title, Category, Submitter, Authors, Affiliations, Review Counts, Average Score, Std Dev, Disputed Flag, Recommendation, Decision, Status.</div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button
                  asChild
                  className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
                >
                  <a
                    href={`/api/v1/orgs/${orgId}/events/${eventId}/decisions/export/excel`}
                    download
                  >
                    <Download className="h-4 w-4" />
                    Download Excel (.xlsx)
                  </a>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── SIDE PANEL: Abstract Inspection & Decision ─── */}
      <SidePanel
        open={!!panelRow}
        onOpenChange={(open) => !open && setPanelRow(null)}
        title={panelRow?.refNo ? `${panelRow.refNo}: ${panelRow.title}` : panelRow?.title || "Abstract"}
        description={`Submitted by ${panelRow?.submitter.fullName || panelRow?.submitter.email} • Track: ${panelRow?.categoryName || "Unassigned"}`}
        footer={<Button variant="outline" onClick={() => setPanelRow(null)}>Close</Button>}
      >
        {panelRow && (
          <div className="space-y-6">
            {/* Peer Review Scores & Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-indigo-600" />
                Peer Review Scores ({panelRow.scoreStats.completedReviews} completed)
              </h4>

              <div className="bg-muted/40 p-3 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground">Average Score: </span>
                  <span className="font-bold text-sm text-foreground">
                    {panelRow.scoreStats.weightedAverageScore.toFixed(2)}
                  </span>
                  {panelRow.scoreStats.standardDeviation > 0 && (
                    <span className="text-muted-foreground"> (±{panelRow.scoreStats.standardDeviation.toFixed(1)})</span>
                  )}
                </div>
                {panelRow.scoreStats.isDisputed && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs">
                    Disputed: Gap {panelRow.scoreStats.scoreGap.toFixed(1)}
                  </Badge>
                )}
              </div>

              {panelRow.reviews.length > 0 ? (
                <div className="space-y-2">
                  {panelRow.reviews.map((rev, rIdx) => (
                    <div key={rev.reviewerId} className="border rounded-md p-3 text-xs space-y-1.5 bg-card">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          Reviewer {rIdx + 1} ({rev.reviewerName})
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            Score: {rev.weightedScore.toFixed(1)}
                          </Badge>
                          {rev.recommendation && (
                            <Badge variant="secondary">
                              {OUTCOME_LABEL[rev.recommendation] || rev.recommendation}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {rev.commentAuthor && (
                        <div className="text-muted-foreground bg-muted/20 p-2 rounded">
                          <strong className="text-foreground">Comments to author:</strong> {rev.commentAuthor}
                        </div>
                      )}
                      {rev.commentCommittee && (
                        <div className="text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded">
                          <strong>Confidential committee note:</strong> {rev.commentCommittee}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">No completed reviews yet.</div>
              )}
            </div>

            {/* Decision Recording Form */}
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Gavel className="h-4 w-4 text-indigo-600" />
                {canDecide ? "Set Decision" : "Track Chair Recommendation"}
              </h4>

              <div className="space-y-2">
                <Label htmlFor="pDecision">
                  {canDecide ? "Select Decision Outcome" : "Your Recommendation"}
                </Label>
                <Select value={panelDecision} onValueChange={setPanelDecision}>
                  <SelectTrigger id="pDecision">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No Decision (Clear)</SelectItem>
                    <SelectItem value="ACCEPT_ORAL">Accept Oral Presentation</SelectItem>
                    <SelectItem value="ACCEPT_POSTER">Accept Poster Presentation</SelectItem>
                    <SelectItem value="REJECT">Reject</SelectItem>
                    <SelectItem value="REVISIONS_REQUESTED">Revisions Requested</SelectItem>
                    <SelectItem value="WAITLIST">Waitlist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pNote">Internal Committee Note (Optional)</Label>
                <Textarea
                  id="pNote"
                  rows={3}
                  value={panelNote}
                  onChange={(e) => setPanelNote(e.target.value)}
                  placeholder="Notes on session scheduling, revisions needed, etc."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPanelRow(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSavePanelDecision} disabled={savingPanel}>
                  {savingPanel ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  {canDecide ? "Save Decision" : "Save Recommendation"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      {/* ─── BULK DECISION MODAL ─── */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Decision for {selectedIds.size} Abstracts</DialogTitle>
            <DialogDescription>
              {canDecide
                ? "This will apply the chosen decision as a provisional decision. It remains hidden until released."
                : "Record your track chair recommendation for these abstracts."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Select value={bulkDecision} onValueChange={setBulkDecision}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCEPT_ORAL">Accept Oral Presentation</SelectItem>
                  <SelectItem value="ACCEPT_POSTER">Accept Poster Presentation</SelectItem>
                  <SelectItem value="REJECT">Reject</SelectItem>
                  <SelectItem value="REVISIONS_REQUESTED">Revisions Requested</SelectItem>
                  <SelectItem value="WAITLIST">Waitlist</SelectItem>
                  <SelectItem value="NONE">Clear Decision (Set None)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Textarea
                rows={2}
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="Optional decision note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBulkDecision} disabled={savingBulk}>
              {savingBulk ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Apply to {selectedIds.size} Abstracts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── APPLY CUTOFFS CONFIRM DIALOG ─── */}
      <ConfirmDialog
        open={applyCutoffsConfirmOpen}
        onOpenChange={setApplyCutoffsConfirmOpen}
        title="Apply Cut-offs as Provisional Decisions?"
        description={`This will update ${cutoffResult?.changes.filter((c) => c.provisionalDecision !== null).length || 0} abstracts with provisional decisions (marked as Cut-off). You can review or override any decision before releasing.`}
        confirmLabel="Apply Provisional Decisions"
        onConfirm={() => handleEvaluateCutoffs("apply")}
      />

      {/* ─── RELEASE CONFIRM DIALOG ─── */}
      <ConfirmDialog
        open={releaseConfirmOpen}
        onOpenChange={setReleaseConfirmOpen}
        title="Release Decisions to Authors?"
        description={`Are you sure you want to release ${pendingInReleaseCategory.length} decisions? Once released, decisions become visible to authors in their portal${sendEmails ? ", and notification emails will be queued." : "."}`}
        confirmLabel="Confirm & Release"
        onConfirm={handleRelease}
      />

      {/* ─── OFFER WAITLIST MODAL ─── */}
      <Dialog open={offerModalOpen} onOpenChange={setOfferModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Offer Declined Slot to Waitlist</DialogTitle>
            <DialogDescription>
              A presentation slot opened because the author of <strong>{declinedRow?.refNo}</strong> declined. Select a waitlisted abstract to offer this slot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {waitlistedRows.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded text-center">
                There are no waitlisted abstracts in this event.
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select Waitlisted Abstract</Label>
                <Select value={selectedWaitlistedId} onValueChange={setSelectedWaitlistedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an abstract..." />
                  </SelectTrigger>
                  <SelectContent>
                    {waitlistedRows.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.refNo || "---"}: {w.title} (Score: {w.scoreStats.weightedAverageScore.toFixed(1)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleOfferWaitlist}
              disabled={submittingOffer || !selectedWaitlistedId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submittingOffer ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Offer Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
