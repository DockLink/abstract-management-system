"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { SidePanel } from "@/components/shared/side-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { formatLongDateTime } from "@/lib/dates";
import { EventIcons } from "@/lib/events/icons";
import { STATUS_MAP, normalizeStatus } from "@/lib/status";
import {
  Eye,
  History,
  AlertTriangle,
  Download,
  CheckCircle2,
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

const STATUS_OPTIONS = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISIONS_REQUESTED",
  "ACCEPTED",
  "CONFIRMED",
  "REJECTED",
  "WAITLISTED",
  "WITHDRAWN",
] as const;

function statusLabel(status: string) {
  const key = normalizeStatus(status);
  return key ? STATUS_MAP[key].label : status;
}

function ercLabel(status: string | null | undefined) {
  if (status === "APPROVED") return "Approved";
  if (status === "EXEMPT") return "Exempt";
  if (status === "NOT_APPLICABLE") return "Not applicable";
  return "Not given";
}

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
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  // What's typed; copied to searchTerm after a short pause so typing doesn't refetch per key.
  const [searchInput, setSearchInput] = useState<string>("");

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
        setLoadError(null);
      } else {
        setLoadError(res.error.message || "The submissions couldn't be loaded.");
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

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

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
        toast.success(`Status changed to ${statusLabel(newStatus).toLowerCase()}`);
        await loadSubmissions();
        if (inspectSub && inspectSub.id === submissionId) {
          setInspectSub(res.data);
        }
      } else {
        toast.error("Couldn't change the status", { description: res.error.message });
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
        toast.error("The duplicate check didn't run", { description: res.error.message });
      }
    } finally {
      setDuplicateLoading(false);
    }
  }

  const activeFilters = [statusFilter, categoryFilter, typeFilter].filter((f) => f !== "ALL").length;
  const categoryName = (id: string | null | undefined) => categories.find((c) => c.id === id)?.name;
  const typeName = (id: string | null | undefined) => submissionTypes.find((t) => t.id === id)?.name;

  const columns: DataTableColumn<SubmissionDto>[] = [
    {
      id: "ref",
      header: "Reference",
      mobile: "meta",
      className: "whitespace-nowrap",
      cell: (sub) =>
        sub.refNo ? (
          <span className="font-mono text-sm text-muted-foreground">{sub.refNo}</span>
        ) : (
          <span className="text-sm text-muted-foreground">No reference yet</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      mobile: "meta",
      className: "whitespace-nowrap",
      cell: (sub) => <StatusBadge status={sub.status} size="sm" />,
    },
    {
      id: "title",
      header: "Title",
      mobile: "title",
      className: "min-w-56",
      cell: (sub) => <span className="line-clamp-2 font-medium">{sub.title || "Untitled"}</span>,
    },
    {
      id: "presenter",
      header: "Presenter",
      cell: (sub) => {
        const presenter = sub.authors?.find((a) => a.isPresenting);
        return presenter ? (
          <span className="block">
            <span className="block font-medium">
              {presenter.surname} {presenter.initials}
            </span>
            {presenter.email ? <span className="block text-sm break-all text-muted-foreground">{presenter.email}</span> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Not marked</span>
        );
      },
    },
    {
      id: "type",
      header: "Type and track",
      cell: (sub) => (
        <span className="block">
          <span className="block">{typeName(sub.submissionTypeId) || "—"}</span>
          <span className="block text-sm text-muted-foreground">{categoryName(sub.categoryId) || "No track chosen"}</span>
        </span>
      ),
    },
    {
      id: "words",
      header: "Words",
      className: "whitespace-nowrap tabular-nums",
      cell: (sub) => sub.wordCount,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submissions"
        description="Every abstract for this event. Open one to read it, check its ethics approval and change its status."
        actions={
          <Button type="button" variant="outline" onClick={scanDuplicates}>
            <AlertTriangle data-icon="inline-start" className="text-warning-foreground" aria-hidden />
            Check duplicate titles
          </Button>
        }
      />

      <FilterBar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search titles"
        searchLabel="Search submissions by title"
        activeCount={activeFilters}
        onClear={() => {
          setSearchInput("");
          setSearchTerm("");
          setStatusFilter("ALL");
          setCategoryFilter("ALL");
          setTypeFilter("ALL");
        }}
        resultCount={loading || loadError ? undefined : { shown: submissions.length, noun: submissions.length === 1 ? "abstract" : "abstracts" }}
      >
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status" className="md:w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUS_OPTIONS.map((st) => (
              <SelectItem key={st} value={st}>{statusLabel(st)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger aria-label="Filter by track" className="md:w-56">
            <SelectValue placeholder="All tracks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All tracks</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger aria-label="Filter by submission type" className="md:w-52">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {submissionTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        caption="Submissions"
        columns={columns}
        rows={submissions}
        getRowId={(sub) => sub.id}
        loading={loading && submissions.length === 0}
        error={loadError}
        onRetry={() => void loadSubmissions()}
        empty={
          activeFilters || searchTerm
            ? { icon: EventIcons.submissions, title: "No abstracts match", description: "Try another search or clear the filters." }
            : { icon: EventIcons.submissions, title: "No abstracts yet", description: "Abstracts appear here as authors start their submissions." }
        }
        rowActions={(sub) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void openVersions(sub)}
              title="Version history"
              aria-label={`Version history for ${sub.refNo ?? sub.title}`}
            >
              <History aria-hidden />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setInspectSub(sub)}>
              <Eye data-icon="inline-start" aria-hidden />
              View
              <span className="sr-only"> {sub.refNo ?? sub.title}</span>
            </Button>
          </div>
        )}
      />

      {/* Abstract detail */}
      <SidePanel
        open={!!inspectSub}
        onOpenChange={(open) => !open && setInspectSub(null)}
        size="lg"
        title={inspectSub?.title || "Untitled"}
        description={
          inspectSub
            ? [inspectSub.refNo || "No reference yet", typeName(inspectSub.submissionTypeId), categoryName(inspectSub.categoryId)].filter(Boolean).join(" · ")
            : undefined
        }
        footer={
          <Button type="button" variant="outline" onClick={() => setInspectSub(null)}>
            Close
          </Button>
        }
      >
        {inspectSub ? (
          <div className="space-y-6 text-base">
            <section aria-labelledby="sub-status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div>
                <h3 id="sub-status" className="text-sm text-muted-foreground">Status</h3>
                <StatusBadge status={inspectSub.status} className="mt-1" />
              </div>
              <Select
                value={inspectSub.status}
                onValueChange={(val) => void updateStatus(inspectSub.id, val)}
                disabled={patchingId === inspectSub.id}
              >
                <SelectTrigger className="w-52" aria-label="Change status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((st) => (
                    <SelectItem key={st} value={st}>{statusLabel(st)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section aria-labelledby="sub-authors">
              <h3 id="sub-authors" className="text-lg font-semibold">Authors</h3>
              {inspectSub.authors?.length ? (
                <>
                  <p className="mt-1">
                    {inspectSub.authors.map((a, i) => (
                      <span key={a.id}>
                        <span className={a.isPresenting ? "underline decoration-2 underline-offset-2" : undefined}>
                          {a.surname} {a.initials}
                        </span>
                        {a.affiliationNos && a.affiliationNos.length > 0 ? <sup>{a.affiliationNos.join(",")}</sup> : null}
                        {i < (inspectSub.authors?.length || 0) - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Presenting author underlined.</p>
                </>
              ) : (
                <p className="mt-1 text-muted-foreground">No authors added yet.</p>
              )}
              {inspectSub.affiliations && inspectSub.affiliations.length > 0 ? (
                <ol className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                  {inspectSub.affiliations.map((aff) => (
                    <li key={aff.number}>
                      <sup>{aff.number}</sup> {aff.text}
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>

            <section aria-labelledby="sub-abstract">
              <h3 id="sub-abstract" className="text-lg font-semibold">
                Abstract <span className="text-sm font-normal text-muted-foreground">· {inspectSub.wordCount} words</span>
              </h3>
              <div className="mt-2 space-y-4 rounded-lg border border-border bg-card p-4">
                {inspectSub.abstractBody && Object.keys(inspectSub.abstractBody).length ? (
                  Object.entries(inspectSub.abstractBody).map(([key, html]) => (
                    <div key={key}>
                      <h4 className="font-semibold capitalize">{key.replace(/_/g, " ")}</h4>
                      <div className="rich-text" dangerouslySetInnerHTML={{ __html: String(html) }} />
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">Nothing written yet.</p>
                )}
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <section aria-labelledby="sub-erc" className="rounded-lg border border-border p-4">
                <h3 id="sub-erc" className="font-semibold">Ethics approval</h3>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex gap-2"><dt className="text-muted-foreground">Status</dt><dd>{ercLabel(inspectSub.ercStatus)}</dd></div>
                  {inspectSub.ercRefNo ? <div className="flex gap-2"><dt className="text-muted-foreground">Reference</dt><dd className="break-all">{inspectSub.ercRefNo}</dd></div> : null}
                  {inspectSub.ercInstitution ? <div className="flex gap-2"><dt className="text-muted-foreground">Committee</dt><dd>{inspectSub.ercInstitution}</dd></div> : null}
                </dl>
                {ercFileUrl ? (
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <a href={ercFileUrl} target="_blank" rel="noreferrer">
                      <Download data-icon="inline-start" aria-hidden />
                      Download certificate (PDF)
                    </a>
                  </Button>
                ) : inspectSub.hasErcFile ? (
                  <p className="mt-3 text-sm text-muted-foreground">Preparing download link…</p>
                ) : null}
              </section>

              <section aria-labelledby="sub-decl" className="rounded-lg border border-border p-4">
                <h3 id="sub-decl" className="font-semibold">Declarations</h3>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">All authors consented</dt><dd className="font-medium">{inspectSub.declarations?.allAuthorsConsented ? "Yes" : "No"}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">No identifiable patient data</dt><dd className="font-medium">{inspectSub.declarations?.noIdentifiablePatientData ? "Yes" : "No"}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Conflict of interest</dt><dd className="font-medium">{inspectSub.declarations?.conflictOfInterest ? "Declared" : "None"}</dd></div>
                </dl>
              </section>
            </div>
          </div>
        ) : null}
      </SidePanel>

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
                      {formatLongDateTime(ver.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
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
              <AlertTriangle className="size-5 text-warning-foreground" aria-hidden />
              <span>Duplicate titles</span>
            </DialogTitle>
            <DialogDescription>
              Abstracts in this event with near-identical titles. Check them before review starts.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 max-h-[60vh] overflow-y-auto space-y-3">
            {duplicateLoading ? (
              <p className="text-sm text-muted-foreground animate-pulse">Scanning event abstracts…</p>
            ) : duplicateClusters.length === 0 ? (
              <div className="rounded-lg border border-success/30 bg-success-tint p-6 text-center text-success-foreground">
                <CheckCircle2 className="mx-auto mb-2 size-8" aria-hidden />
                <p className="text-base font-semibold">No duplicate titles found</p>
                <p className="mt-1 text-sm">Every abstract in this event has a distinct title.</p>
              </div>
            ) : (
              duplicateClusters.map((cluster, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-lg border border-warning/30 bg-warning-tint p-4 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-warning-foreground">
                      {Math.round(cluster.similarity * 100)}% similar
                    </span>
                    <Badge variant="destructive">
                      Possible duplicate
                    </Badge>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="rounded-md border border-warning/30 bg-card p-2">
                      <span className="font-mono font-bold text-muted-foreground mr-2">
                        {cluster.submissionA.refNo || "Draft"}
                      </span>
                      <span className="font-medium text-foreground">{cluster.submissionA.title}</span>
                    </div>
                    <div className="rounded-md border border-warning/30 bg-card p-2">
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

