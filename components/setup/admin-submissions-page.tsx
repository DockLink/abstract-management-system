"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api/client";
import { EventIcons } from "@/lib/events/icons";
import {
  Search,
  Eye,
  History,
  AlertTriangle,
  Download,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  Filter,
} from "lucide-react";
import type {
  CategoryDto,
  SubmissionDto,
  SubmissionTypeDto,
  SubmissionVersionDto,
} from "@/lib/types/api";

type DuplicateCluster = {
  submissionA: { id: string; refNo: string | null; title: string; status: string };
  submissionB: { id: string; refNo: string | null; title: string; status: string };
  similarity: number;
};

export function AdminSubmissionsPage({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;

  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [submissionTypes, setSubmissionTypes] = useState<SubmissionTypeDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Inspect Modal
  const [inspectSub, setInspectSub] = useState<SubmissionDto | null>(null);
  const [ercFileUrl, setErcFileUrl] = useState<string | null>(null);

  // Version History Modal
  const [versionSub, setVersionSub] = useState<SubmissionDto | null>(null);
  const [versions, setVersions] = useState<SubmissionVersionDto[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Duplicate Check Modal (SUB-15)
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateClusters, setDuplicateClusters] = useState<DuplicateCluster[]>([]);
  const [duplicateLoading, setDuplicateLoading] = useState(false);

  // Status update
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("categoryId", categoryFilter);
      if (typeFilter !== "ALL") params.set("submissionTypeId", typeFilter);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const res = await apiFetch<{ data: SubmissionDto[] }>(
        `${base}/submissions?${params.toString()}`,
      );
      if (res.ok) {
        setSubmissions(res.data.data);
      } else {
        toast.error(res.error.message || "Failed to load submissions");
      }
    } finally {
      setLoading(false);
    }
  }, [base, statusFilter, categoryFilter, typeFilter, searchTerm]);

  useEffect(() => {
    async function loadAux() {
      const [catsRes, typesRes] = await Promise.all([
        apiFetch<CategoryDto[]>(`${base}/categories`),
        apiFetch<SubmissionTypeDto[]>(`${base}/submission-types`),
      ]);
      if (catsRes.ok) setCategories(catsRes.data);
      if (typesRes.ok) setSubmissionTypes(typesRes.data);
    }
    void loadAux();
  }, [base]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  // Load ERC file signed URL when inspecting
  useEffect(() => {
    if (!inspectSub || !inspectSub.hasErcFile) {
      setErcFileUrl(null);
      return;
    }
    async function loadErcUrl() {
      const res = await apiFetch<{ url: string }>(
        `${base}/submissions/${inspectSub!.id}/files?kind=erc`,
      );
      if (res.ok) {
        setErcFileUrl(res.data.url);
      }
    }
    void loadErcUrl();
  }, [base, inspectSub]);

  // Admin status patch
  async function updateStatus(submissionId: string, newStatus: string) {
    setPatchingId(submissionId);
    try {
      const res = await apiFetch<SubmissionDto>(`${base}/submissions/${submissionId}`, {
        method: "PATCH",
        body: { status: newStatus },
      });
      if (res.ok) {
        toast.success(`Status updated to ${newStatus}`);
        await loadSubmissions();
        if (inspectSub && inspectSub.id === submissionId) {
          setInspectSub(res.data);
        }
      } else {
        toast.error(res.error.message || "Failed to update status");
      }
    } finally {
      setPatchingId(null);
    }
  }

  // Load versions
  async function openVersions(sub: SubmissionDto) {
    setVersionSub(sub);
    setVersionsLoading(true);
    try {
      const res = await apiFetch<SubmissionVersionDto[]>(
        `${base}/submissions/${sub.id}/versions`,
      );
      if (res.ok) setVersions(res.data);
    } finally {
      setVersionsLoading(false);
    }
  }

  // Run duplicate check scan (SUB-15)
  async function scanDuplicates() {
    setDuplicateLoading(true);
    setDuplicateModalOpen(true);
    try {
      const res = await apiFetch<{ clusters?: DuplicateCluster[] }>(
        `${base}/submissions/duplicate-check`,
      );
      if (res.ok) {
        setDuplicateClusters(res.data.clusters || []);
      } else {
        toast.error(res.error.message || "Duplicate check failed");
      }
    } finally {
      setDuplicateLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Submissions"
          description="Review submitted abstracts, check duplicate titles, view change history, and manage presentation decisions."
        />
        <Button
          type="button"
          variant="outline"
          onClick={scanDuplicates}
          className="gap-1.5 shrink-0"
        >
          <AlertTriangle className="size-4 text-amber-600" />
          Check Duplicate Titles
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card className="border border-border bg-white shadow-sm p-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search title…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
              <SelectItem value="REVISIONS_REQUESTED">Revisions Requested</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="WAITLISTED">Waitlisted</SelectItem>
              <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Submission Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {submissionTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Submissions List */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading submissions…</p>
        </div>
      ) : submissions.length === 0 ? (
        <EmptyState
          icon={EventIcons.submissions}
          title="No submissions found"
          description="No abstracts match your filter criteria."
        />
      ) : (
        <div className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Ref No</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Presenter</th>
                  <th className="py-3 px-4">Type & Category</th>
                  <th className="py-3 px-4">Words</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissions.map((sub) => {
                  const presenter = sub.authors?.find((a) => a.isPresenting);
                  const cat = categories.find((c) => c.id === sub.categoryId);
                  const subType = submissionTypes.find((t) => t.id === sub.submissionTypeId);

                  return (
                    <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-xs text-muted-foreground whitespace-nowrap">
                        {sub.refNo || "Draft"}
                      </td>
                      <td className="py-3 px-4 max-w-xs font-medium text-foreground">
                        <div className="truncate" title={sub.title}>
                          {sub.title || "Untitled"}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        {presenter ? (
                          <div>
                            <p className="font-semibold text-foreground">
                              {presenter.surname}, {presenter.initials}
                            </p>
                            <p className="text-muted-foreground text-[11px]">{presenter.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">None marked</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        <p className="font-medium text-foreground">{subType?.name || "General"}</p>
                        <p className="text-muted-foreground text-[11px]">{cat?.name || "Uncategorized"}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-mono">
                        {sub.wordCount}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs font-semibold">
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openVersions(sub)}
                            title="Version History"
                          >
                            <History className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            onClick={() => setInspectSub(sub)}
                          >
                            <Eye className="size-3.5" />
                            Inspect
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

      {/* Inspect Modal */}
      <Dialog open={!!inspectSub} onOpenChange={(open) => !open && setInspectSub(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <Badge variant="outline" className="font-mono text-xs font-bold">
                {inspectSub?.refNo || "Draft"}
              </Badge>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Select
                  value={inspectSub?.status}
                  onValueChange={(val) => {
                    if (inspectSub) void updateStatus(inspectSub.id, val);
                  }}
                  disabled={patchingId === inspectSub?.id}
                >
                  <SelectTrigger className="h-8 text-xs w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="REVISIONS_REQUESTED">Revisions Requested</SelectItem>
                    <SelectItem value="ACCEPTED">Accepted</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="WAITLISTED">Waitlisted</SelectItem>
                    <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground mt-2">
              {inspectSub?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1 text-sm">
            {/* Authors & Affiliations */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Authors & Affiliations
              </p>
              <p className="font-semibold text-foreground text-sm">
                {inspectSub?.authors?.map((a, i) => (
                  <span key={a.id}>
                    <span className={a.isPresenting ? "underline decoration-primary font-bold" : ""}>
                      {a.surname} {a.initials}
                    </span>
                    {a.affiliationNos && a.affiliationNos.length > 0 ? (
                      <sup className="text-primary font-bold">{a.affiliationNos.join(",")}</sup>
                    ) : null}
                    {i < (inspectSub.authors?.length || 0) - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
              {inspectSub?.affiliations && inspectSub.affiliations.length > 0 ? (
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                  {inspectSub.affiliations.map((aff) => (
                    <p key={aff.number}>
                      <sup>{aff.number}</sup> {aff.text}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Abstract Sections */}
            <div className="space-y-4">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Abstract Body ({inspectSub?.wordCount} words)
              </p>
              {inspectSub?.abstractBody &&
                Object.entries(inspectSub.abstractBody).map(([key, html]) => (
                  <div key={key} className="space-y-1 rounded-lg border border-border p-3.5 bg-white">
                    <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      {key}
                    </span>
                    <div
                      className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: String(html) }}
                    />
                  </div>
                ))}
            </div>

            {/* Ethics & Declarations info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-3.5 space-y-1">
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Ethics (ERC)
                </span>
                <p className="text-xs font-medium">Status: {inspectSub?.ercStatus || "N/A"}</p>
                {inspectSub?.ercRefNo ? (
                  <p className="text-xs text-muted-foreground">Ref: {inspectSub.ercRefNo}</p>
                ) : null}
                {inspectSub?.ercInstitution ? (
                  <p className="text-xs text-muted-foreground">Inst: {inspectSub.ercInstitution}</p>
                ) : null}
                {ercFileUrl ? (
                  <a
                    href={ercFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Download className="size-3.5" />
                    Download ERC Certificate (PDF)
                  </a>
                ) : null}
              </div>

              <div className="rounded-lg border border-border p-3.5 space-y-1">
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Declarations
                </span>
                <p className="text-xs">
                  Consent:{" "}
                  <strong>{inspectSub?.declarations?.allAuthorsConsented ? "Yes" : "No"}</strong>
                </p>
                <p className="text-xs">
                  Confidentiality:{" "}
                  <strong>
                    {inspectSub?.declarations?.noIdentifiablePatientData ? "Yes" : "No"}
                  </strong>
                </p>
                <p className="text-xs">
                  COI:{" "}
                  <strong>
                    {inspectSub?.declarations?.conflictOfInterest ? "Declared" : "None"}
                  </strong>
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setInspectSub(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Modal (SUB-13) */}
      <Dialog open={!!versionSub} onOpenChange={(open) => !open && setVersionSub(null)}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              <span>Version History ({versionSub?.refNo || "Draft"})</span>
            </DialogTitle>
            <DialogDescription>
              Every snapshot saved across editing and status changes.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 max-h-[60vh] overflow-y-auto">
            {versionsLoading ? (
              <p className="text-xs text-muted-foreground">Loading versions…</p>
            ) : versions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No historical versions found.</p>
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
                    Captured by user ID: {ver.createdById}
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

      {/* Duplicate Check Scan Modal (SUB-15) */}
      <Dialog open={duplicateModalOpen} onOpenChange={setDuplicateModalOpen}>
        <DialogContent className="max-w-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              <span>Duplicate Title Check Scan</span>
            </DialogTitle>
            <DialogDescription>
              Scans all active event abstracts for near-identical titles using token and character-level similarity algorithms.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 max-h-[60vh] overflow-y-auto space-y-3">
            {duplicateLoading ? (
              <p className="text-sm text-muted-foreground animate-pulse">Scanning event abstracts…</p>
            ) : duplicateClusters.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800">
                <CheckCircle2 className="size-8 mx-auto text-emerald-600 mb-2" />
                <p className="font-semibold text-sm">No duplicate titles detected</p>
                <p className="text-xs mt-1">All abstracts submitted to this event have distinct titles.</p>
              </div>
            ) : (
              duplicateClusters.map((cluster, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-amber-300 bg-amber-50/50 p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-800">
                      Match Similarity: {Math.round(cluster.similarity * 100)}%
                    </span>
                    <Badge variant="destructive" className="text-[10px] h-4">
                      Potential Duplicate
                    </Badge>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="p-2 rounded bg-white border border-amber-200">
                      <span className="font-mono font-bold text-muted-foreground mr-2">
                        {cluster.submissionA.refNo || "Draft"}
                      </span>
                      <span className="font-medium text-foreground">{cluster.submissionA.title}</span>
                    </div>
                    <div className="p-2 rounded bg-white border border-amber-200">
                      <span className="font-mono font-bold text-muted-foreground mr-2">
                        {cluster.submissionB.refNo || "Draft"}
                      </span>
                      <span className="font-medium text-foreground">{cluster.submissionB.title}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDuplicateModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

