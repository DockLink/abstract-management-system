"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CsvImportDropzone } from "@/components/shared/csv-import-dropzone";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const load = useCallback(async () => {
    const result = await apiFetch<MemberDto[]>(base, {
      searchParams: search ? { q: search } : undefined,
    });
    if (!result.ok) {
      toast.error(result.error.message || "Could not load members");
      setLoading(false);
      return;
    }
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
      toast.error("No valid rows to import (name is required)");
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
        toast.error(result.error.message || "Import failed");
        return;
      }

      const { created, updated, parseErrors } = result.data;
      toast.success(
        `Import complete: ${created} created, ${updated} updated${
          parseErrors.length ? `, ${parseErrors.length} parse warning(s)` : ""
        }`,
      );
      if (parseErrors.length) {
        parseErrors.slice(0, 3).forEach((err) => toast.warning(err));
      }
      setImportOpen(false);
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
        toast.error(`Could not delete ${failed} member(s)`);
      } else {
        toast.success("Member list cleared");
      }
      setClearOpen(false);
      await load();
    } finally {
      setClearLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Members"
        description="Organisation member list used for author eligibility checks."
        actions={
          members.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="size-4" />
              Clear list
            </Button>
          ) : null
        }
      />

      <CsvImportDropzone
        onFile={handleCsvFile}
        disabled={importLoading || clearLoading}
      />

      <div className="relative mt-6 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-10 pl-9"
          placeholder="Search by name, email, or numbers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <EmptyState
            icon={MembersIcon}
            title="No members"
            description="Import a CSV to populate the member list for this organisation."
          />
        ) : (
          <Card className="border border-border bg-white py-0 ring-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Membership no.</TableHead>
                    <TableHead>SLMC no.</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.membershipNo ?? "—"}</TableCell>
                      <TableCell>{member.slmcNo ?? "—"}</TableCell>
                      <TableCell>{member.email ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {importOpen ? (
        <Card className="mt-6 border border-border bg-white">
          <CardContent className="flex flex-col gap-4 pt-6">
            <p className="text-sm font-medium">Map columns & preview</p>
            <p className="text-xs text-muted-foreground">
              First {previewRows.length} of {rawRows.length} row(s) shown.
            </p>
            {headers.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {headers.map((header, index) => (
                  <div key={`${header}-${index}`} className="flex flex-col gap-1.5">
                    <Label>{header || `Column ${index + 1}`}</Label>
                    <Select
                      value={columnMap[index] ?? "skip"}
                      onValueChange={(v) =>
                        updateColumnMap(index, v as MemberField)
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="membershipNo">Membership no.</SelectItem>
                        <SelectItem value="slmcNo">SLMC no.</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            ) : null}

            {previewRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => (
                        <TableHead key={`${h}-${i}`}>{h || `Col ${i + 1}`}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, ri) => (
                      <TableRow key={ri}>
                        {headers.map((_, ci) => (
                          <TableCell key={ci}>{row[ci] ?? ""}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                disabled={importLoading}
                onClick={() => {
                  setImportOpen(false);
                  setSourceFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-10"
                disabled={importLoading}
                onClick={() => void submitImport()}
              >
                {importLoading
                  ? "Importing…"
                  : `Import ${mappedRows.length} row(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear member list?"
        description={`This will delete all ${members.length} member record(s) one by one. This cannot be undone.`}
        confirmLabel="Clear all"
        destructive
        loading={clearLoading}
        onConfirm={confirmClearList}
      />
    </div>
  );
}
