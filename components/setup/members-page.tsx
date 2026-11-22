"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FileUpload } from "@/components/shared/file-upload";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { StepIndicator } from "@/components/shared/step-indicator";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api/client";
import { EventIcons } from "@/lib/events/icons";
import type { MemberDto } from "@/lib/types/api";

type MemberField = "name" | "membershipNo" | "slmcNo" | "email" | "skip";

type MappedMember = {
  name: string;
  membershipNo: string | null;
  slmcNo: string | null;
  email: string | null;
};

type MembersImportResult = {
  created: number;
  updated: number;
  parseErrors: string[];
  totalProcessed: number;
};

function parseCsvSimple(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string) =>
    line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));

  const headers = splitLine(lines[0] ?? "");
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function guessMapping(header: string): MemberField {
  const h = header.toLowerCase().replace(/\s+/g, "_");
  if (h.includes("name")) return "name";
  if (h.includes("membership")) return "membershipNo";
  if (h.includes("slmc")) return "slmcNo";
  if (h.includes("email")) return "email";
  return "skip";
}

export function MembersPage({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const MembersIcon = EventIcons.members;
  const base = `/api/v1/orgs/${orgId}/events/${eventId}/members`;

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<MemberField[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState(0);
  const [importResult, setImportResult] = useState<MembersImportResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await apiFetch<MemberDto[]>(base, {
      searchParams: search ? { q: search } : undefined,
    });
    if (!result.ok) {
      setLoadError(result.error.message || "The member list couldn't be loaded.");
      setLoading(false);
      return;
    }
    setLoadError(null);
    setMembers(result.data);
    setLoading(false);
  }, [base, search]);

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const previewRows = useMemo(() => rawRows.slice(0, 10), [rawRows]);

  const mappedRows = useMemo((): MappedMember[] => {
    return rawRows
      .map((row) => {
        const out: MappedMember = {
          name: "",
          membershipNo: null,
          slmcNo: null,
          email: null,
        };
        row.forEach((cell, colIndex) => {
          const field = columnMap[colIndex] ?? "skip";
          const value = cell.trim();
          if (!value || field === "skip") return;
          if (field === "name") out.name = value;
          if (field === "membershipNo") out.membershipNo = value;
          if (field === "slmcNo") out.slmcNo = value;
          if (field === "email") out.email = value.toLowerCase();
        });
        return out;
      })
      .filter((row) => row.name.length > 0);
  }, [rawRows, columnMap]);

  function handleCsvFile(file: File) {
    setSourceFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsvSimple(text);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setColumnMap(parsed.headers.map((h) => guessMapping(h)));
      setImportResult(null);
      setImportStep(1);
      setImportOpen(true);
    };
    reader.readAsText(file);
  }

  function updateColumnMap(index: number, field: MemberField) {
    setColumnMap((prev) => {
      const next = [...prev];
      next[index] = field;
      return next;
    });
  }

  async function submitImport() {
    if (mappedRows.length === 0) {
      toast.error("Nothing to import", { description: "Every row needs a name. Map a column to Name." });
      return;
    }

    setImportLoading(true);
    try {
      const useMultipart =
        sourceFile !== null &&
        columnMap.every(
          (field, index) => field === guessMapping(headers[index] ?? ""),
        );

      const result = useMultipart
        ? await apiFetch<MembersImportResult>(base, {
            method: "POST",
            formData: (() => {
              const form = new FormData();
              form.append("file", sourceFile);
              return form;
            })(),
          })
        : await apiFetch<MembersImportResult>(base, {
            method: "POST",
            body: { members: mappedRows },
          });

      if (!result.ok) {
        toast.error("Import failed", { description: result.error.message });
        return;
      }

      const { created, updated } = result.data;
      toast.success("Members imported", `${created} added, ${updated} updated`);
      // Keep the panel open on a result step so any server warnings can be read in full.
      setImportResult(result.data);
      setImportStep(3);
      setSourceFile(null);
      setRawRows([]);
      setHeaders([]);
      await load();
    } finally {
      setImportLoading(false);
    }
  }

  async function confirmClearList() {
    setClearLoading(true);
    try {
      let failed = 0;
      for (const member of members) {
        const result = await apiFetch<{ id: string; deleted: boolean }>(
          `${base}/${member.id}`,
          { method: "DELETE" },
        );
        if (!result.ok) failed += 1;
      }
      if (failed > 0) {
        toast.error(`Couldn't remove ${failed} member${failed === 1 ? "" : "s"}`, { description: "Try clearing the list again." });
      } else {
        toast.success("Member list cleared");
      }
      setClearOpen(false);
      await load();
    } finally {
      setClearLoading(false);
    }
  }

  /* Row-level checks for the preview. Informational only: what is sent is
     unchanged (rows without a name are skipped, exactly as before). */
  const rowIssues = useMemo(() => {
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const idx = (f: MemberField) => columnMap.indexOf(f);
    const seen = new Map<string, number>();
    const issues: Array<{ line: number; message: string; skipped: boolean }> = [];
    rawRows.forEach((row, i) => {
      const line = i + 2; // header is line 1
      const name = idx("name") >= 0 ? (row[idx("name")] ?? "").trim() : "";
      if (!name) issues.push({ line, message: "No name — this row will be skipped.", skipped: true });
      if (headers.length && row.length !== headers.length) {
        issues.push({ line, message: `Has ${row.length} columns; the header has ${headers.length}. Check for stray commas.`, skipped: false });
      }
      const email = idx("email") >= 0 ? (row[idx("email")] ?? "").trim() : "";
      if (email && !EMAIL.test(email)) issues.push({ line, message: `“${email}” doesn't look like an email address.`, skipped: false });
      const no = idx("membershipNo") >= 0 ? (row[idx("membershipNo")] ?? "").trim() : "";
      if (no) {
        if (seen.has(no)) issues.push({ line, message: `Membership no. ${no} also appears on line ${seen.get(no)}.`, skipped: false });
        else seen.set(no, line);
      }
    });
    return issues;
  }, [rawRows, columnMap, headers.length]);

  const skippedCount = rawRows.length - mappedRows.length;
  const hasNameColumn = columnMap.includes("name");

  const closeImport = () => {
    if (importLoading) return;
    setImportOpen(false);
    setSourceFile(null);
    setImportStep(0);
  };

  const columns: DataTableColumn<MemberDto>[] = [
    { id: "name", header: "Name", mobile: "title", cell: (m) => <span className="font-medium">{m.name}</span> },
    { id: "membershipNo", header: "Membership no.", cell: (m) => m.membershipNo ?? "—" },
    { id: "slmcNo", header: "SLMC no.", cell: (m) => m.slmcNo ?? "—" },
    { id: "email", header: "Email", cell: (m) => <span className="[overflow-wrap:anywhere]">{m.email ?? "—"}</span> },
  ];

  const FIELD_LABEL: Record<MemberField, string> = {
    name: "Name",
    membershipNo: "Membership no.",
    slmcNo: "SLMC no.",
    email: "Email",
    skip: "Don't import",
  };

  return (
    <div>
      <PageHeader
        title="Members"
        description="Your college's member list. Used to check member-author eligibility and member pricing."
        actions={
          <Button
            type="button"
            onClick={() => {
              setImportResult(null);
              setImportStep(0);
              setImportOpen(true);
            }}
          >
            <Upload data-icon="inline-start" />
            Import CSV
          </Button>
        }
      />

      <div className="space-y-4">
        <FilterBar
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search by name, email or number"
          searchLabel="Search members"
          resultCount={loading || loadError ? undefined : { shown: members.length, noun: members.length === 1 ? "member" : "members" }}
        />
        <DataTable
          caption="Members"
          columns={columns}
          rows={members}
          getRowId={(m) => m.id}
          loading={loading}
          error={loadError}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
          empty={{
            icon: MembersIcon,
            title: search ? "No members match" : "No members yet",
            description: search
              ? "Try a different name, email or number."
              : "Import a CSV with name, membership number, SLMC number and email.",
            action: search ? undefined : (
              <Button onClick={() => { setImportStep(0); setImportOpen(true); }}>
                <Upload data-icon="inline-start" />
                Import CSV
              </Button>
            ),
          }}
        />
      </div>

      {members.length > 0 && !search ? (
        <section aria-labelledby="danger-zone" className="mt-12 rounded-lg border border-danger/30 p-4 md:p-5">
          <h2 id="danger-zone" className="text-lg font-semibold">Clear the member list</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Removes all {members.length} members. Use this before importing a fresh list for a new year.
          </p>
          <Button type="button" variant="destructive" className="mt-4" onClick={() => setClearOpen(true)}>
            <Trash2 data-icon="inline-start" />
            Clear list…
          </Button>
        </section>
      ) : null}

      <SidePanel
        open={importOpen}
        onOpenChange={(o) => (o ? setImportOpen(true) : closeImport())}
        size="lg"
        title="Import members"
        description="Upload a CSV, check it, then import. Existing members are updated, not duplicated."
        footer={
          importStep === 0 ? (
            <Button variant="outline" onClick={closeImport}>Cancel</Button>
          ) : importStep === 1 ? (
            <>
              <Button variant="outline" onClick={() => setImportStep(0)}>Choose another file</Button>
              <Button disabled={mappedRows.length === 0} onClick={() => setImportStep(2)}>
                Continue
              </Button>
            </>
          ) : importStep === 2 ? (
            <>
              <Button variant="outline" disabled={importLoading} onClick={() => setImportStep(1)}>Back</Button>
              <Button disabled={importLoading || mappedRows.length === 0} onClick={() => void submitImport()}>
                {importLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                {importLoading ? "Importing…" : `Import ${mappedRows.length} member${mappedRows.length === 1 ? "" : "s"}`}
              </Button>
            </>
          ) : (
            <Button onClick={closeImport}>Done</Button>
          )
        }
      >
        <div className="space-y-6">
          {importStep < 3 ? (
            <StepIndicator
              steps={[{ label: "Upload" }, { label: "Check" }, { label: "Confirm" }]}
              current={importStep}
            />
          ) : null}

          {importStep === 0 ? (
            <div className="space-y-4">
              <FileUpload
                label="Member list (CSV)"
                accept=".csv,text/csv"
                acceptLabel="CSV"
                maxSizeMb={5}
                onSelect={handleCsvFile}
              />
              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="font-medium">Expected columns</p>
                <p className="mt-1 font-mono text-muted-foreground">name, membership number, SLMC number, email</p>
                <p className="mt-2 text-muted-foreground">The first row must be the column names. Only name is required.</p>
              </div>
            </div>
          ) : null}

          {importStep === 1 ? (
            <div className="space-y-6">
              <p className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="size-5 text-brand-ink" aria-hidden />
                <span className="min-w-0 [overflow-wrap:anywhere]"><strong className="font-semibold">{sourceFile?.name ?? "CSV"}</strong> · {rawRows.length} rows</span>
              </p>

              <section aria-labelledby="map-cols">
                <h3 id="map-cols" className="text-lg font-semibold">Match the columns</h3>
                <p className="text-sm text-muted-foreground">We guessed from the headings. Change any that are wrong.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {headers.map((header, index) => (
                    <div key={`${header}-${index}`} className="grid gap-1.5">
                      <Label htmlFor={`map-${index}`} className="text-sm font-medium">“{header || `Column ${index + 1}`}”</Label>
                      <Select value={columnMap[index] ?? "skip"} onValueChange={(v) => updateColumnMap(index, v as MemberField)}>
                        <SelectTrigger id={`map-${index}`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["name", "membershipNo", "slmcNo", "email", "skip"] as MemberField[]).map((f) => (
                            <SelectItem key={f} value={f}>{FIELD_LABEL[f]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                {!hasNameColumn ? (
                  <p role="alert" className="mt-3 text-sm font-medium text-danger-foreground">Choose which column holds the member&apos;s name.</p>
                ) : null}
              </section>

              <section aria-labelledby="preview-rows">
                <h3 id="preview-rows" className="text-lg font-semibold">First {previewRows.length} rows</h3>
                <div className="relative mt-3 overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">Line</th>
                        {headers.map((h, i) => (
                          <th key={`${h}-${i}`} scope="col" className="px-3 py-2 font-medium whitespace-nowrap text-muted-foreground">
                            {FIELD_LABEL[columnMap[i] ?? "skip"]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => {
                        const line = ri + 2;
                        const flagged = rowIssues.some((x) => x.line === line);
                        return (
                          <tr key={ri} className={flagged ? "bg-warning-tint/60" : "border-t border-border"}>
                            <td className="px-3 py-2 text-muted-foreground tabular-nums">{line}</td>
                            {headers.map((_, ci) => (
                              <td key={ci} className={columnMap[ci] === "skip" ? "px-3 py-2 text-muted-foreground line-through" : "px-3 py-2 whitespace-nowrap"}>
                                {row[ci] ?? ""}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section aria-labelledby="row-issues">
                <h3 id="row-issues" className="text-lg font-semibold">
                  {rowIssues.length ? `${rowIssues.length} thing${rowIssues.length === 1 ? "" : "s"} to check` : "No problems found"}
                </h3>
                {rowIssues.length ? (
                  <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {rowIssues.map((x, k) => (
                      <li key={k} className="flex gap-3 rounded px-2 py-1.5 text-sm">
                        <span className="shrink-0 font-mono text-muted-foreground tabular-nums">Line {x.line}</span>
                        <span className={x.skipped ? "text-danger-foreground" : "text-warning-foreground"}>{x.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 flex items-center gap-2 text-base text-success-foreground">
                    <CheckCircle2 className="size-5" aria-hidden />
                    Every row has a name and the columns line up.
                  </p>
                )}
              </section>
            </div>
          ) : null}

          {importStep === 2 ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-5">
                <p className="font-heading text-3xl font-semibold tabular-nums">{mappedRows.length}</p>
                <p className="text-base text-muted-foreground">members will be added or updated</p>
              </div>
              {skippedCount > 0 ? (
                <p className="flex items-start gap-2 text-base text-warning-foreground">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
                  {skippedCount} row{skippedCount === 1 ? "" : "s"} without a name will be skipped.
                </p>
              ) : null}
              <p className="text-base text-muted-foreground">
                Members already on the list are matched and updated. Nobody is removed — use “Clear list” for that.
              </p>
            </div>
          ) : null}

          {importStep === 3 && importResult ? (
            <div className="space-y-4" role="status">
              <p className="flex items-center gap-2 text-lg font-semibold">
                <CheckCircle2 className="size-6 text-success" aria-hidden />
                Import complete
              </p>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-4">
                  <dt className="text-sm text-muted-foreground">Added</dt>
                  <dd className="font-heading text-3xl font-semibold tabular-nums">{importResult.created}</dd>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <dt className="text-sm text-muted-foreground">Updated</dt>
                  <dd className="font-heading text-3xl font-semibold tabular-nums">{importResult.updated}</dd>
                </div>
              </dl>
              {importResult.parseErrors.length ? (
                <div>
                  <p className="text-base font-medium text-warning-foreground">
                    The server flagged {importResult.parseErrors.length} row{importResult.parseErrors.length === 1 ? "" : "s"}:
                  </p>
                  <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-3 text-sm">
                    {importResult.parseErrors.map((e, k) => <li key={k}>{e}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SidePanel>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear the member list?"
        description={`All ${members.length} members will be removed. Member-author checks will fail until you import a new list. You can't undo this.`}
        confirmLabel="Clear list"
        destructive
        loading={clearLoading}
        onConfirm={confirmClearList}
      />
    </div>
  );
}
