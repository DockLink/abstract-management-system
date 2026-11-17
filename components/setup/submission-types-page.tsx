"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api/client";
import { EventIcons } from "@/lib/events/icons";
import type {
  PresentationTypeDto,
  SubmissionTypeDto,
} from "@/lib/types/api";

function parseSections(
  sections: SubmissionTypeDto["sections"],
): Array<{ key: string; label: string }> {
  if (!Array.isArray(sections)) return [];
  return sections
    .filter(
      (s): s is { key: string; label: string } =>
        typeof s === "object" &&
        s !== null &&
        "key" in s &&
        "label" in s &&
        typeof (s as { key: unknown }).key === "string" &&
        typeof (s as { label: unknown }).label === "string",
    )
    .map((s) => ({ key: s.key, label: s.label }));
}

export function SubmissionTypesPage({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const TypesIcon = EventIcons.submissionTypes;
  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;

  const [types, setTypes] = useState<SubmissionTypeDto[]>([]);
  const [presentationTypes, setPresentationTypes] = useState<
    PresentationTypeDto[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<SubmissionTypeDto | null>(null);
  const [name, setName] = useState("");
  const [wordLimit, setWordLimit] = useState("300");
  const [requiresErc, setRequiresErc] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const load = useCallback(async () => {
    const [typesRes, presRes] = await Promise.all([
      apiFetch<SubmissionTypeDto[]>(`${base}/submission-types`),
      apiFetch<PresentationTypeDto[]>(`${base}/presentation-types`),
    ]);

    if (typesRes.ok) setTypes(typesRes.data);
    else toast.error(typesRes.error.message || "Could not load submission types");

    if (presRes.ok) setPresentationTypes(presRes.data);
    else toast.error(presRes.error.message || "Could not load presentation types");

    setLoading(false);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(type: SubmissionTypeDto) {
    setEditing(type);
    setName(type.name);
    setWordLimit(String(type.wordLimit));
    setRequiresErc(type.requiresErc);
    setEditOpen(true);
  }

  async function saveType() {
    if (!editing) return;
    const trimmed = name.trim();
    const limit = Number.parseInt(wordLimit, 10);
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    if (!Number.isFinite(limit) || limit <= 0) {
      toast.error("Word limit must be a positive number");
      return;
    }

    setSaveLoading(true);
    try {
      const result = await apiFetch<SubmissionTypeDto>(
        `${base}/submission-types/${editing.id}`,
        {
          method: "PATCH",
          body: {
            name: trimmed,
            wordLimit: limit,
            requiresErc,
          },
        },
      );
      if (!result.ok) {
        toast.error(result.error.message || "Could not update submission type");
        return;
      }
      toast.success("Submission type updated");
      setEditOpen(false);
      await load();
    } finally {
      setSaveLoading(false);
    }
  }

  const activePresentation = presentationTypes.filter((p) => p.isActive);

  return (
    <div>
      <PageHeader
        title="Submission types"
        description="Configure abstract forms and word limits. Presentation options are decided after review."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : types.length === 0 ? (
        <EmptyState
          icon={TypesIcon}
          title="No submission types"
          description="Submission types are usually created when you set up the event."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {types.map((type) => {
            const sections = parseSections(type.sections);
            return (
              <Card key={type.id} className="border border-border bg-white">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div>
                    <CardTitle className="text-base">{type.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Word limit:{" "}
                      <span className="font-medium text-foreground">
                        {type.wordLimit}
                      </span>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => openEdit(type)}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Form sections
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {sections.map((section) => (
                        <Badge key={section.key} variant="outline">
                          {section.label}
                        </Badge>
                      ))}
                    </ul>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block w-fit">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-10"
                          disabled
                        >
                          Edit form fields
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Coming in form builder</TooltipContent>
                  </Tooltip>
                  {type.requiresErc ? (
                    <p className="text-xs text-muted-foreground">
                      Ethics (ERC) declaration required
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">
          Presentation types
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only in v1. Options shown to authors after acceptance decisions
          (Module 3).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {activePresentation.length === 0 ? (
            <span className="text-sm text-muted-foreground">None configured</span>
          ) : (
            activePresentation.map((ptype) => (
              <Badge key={ptype.id} variant="outline" className="px-3 py-1">
                {ptype.label}
              </Badge>
            ))
          )}
        </div>
      </section>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit submission type</DialogTitle>
            <DialogDescription>
              Update name, word limit, and ethics requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="stype-name">Name</Label>
              <Input
                id="stype-name"
                className="h-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="stype-word-limit">Word limit</Label>
              <Input
                id="stype-word-limit"
                className="h-10"
                type="number"
                min={1}
                value={wordLimit}
                onChange={(e) => setWordLimit(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="stype-erc">Requires ERC declaration</Label>
                <p className="text-xs text-muted-foreground">
                  Authors must confirm ethics approval when submitting.
                </p>
              </div>
              <Switch
                id="stype-erc"
                checked={requiresErc}
                onCheckedChange={setRequiresErc}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={saveLoading}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10"
              disabled={saveLoading}
              onClick={() => void saveType()}
            >
              {saveLoading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
