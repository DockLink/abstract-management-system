"use client";

import { useCallback, useEffect, useState } from "react";
import { FormBuilderDialog } from "@/components/setup/form-builder-dialog";
import { Layers, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { CardListSkeleton } from "@/components/shared/skeletons";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

const PRESENTATION_CODES = [
  { code: "ORAL", label: "Oral" },
  { code: "POSTER", label: "Poster" },
  { code: "ORAL_OR_POSTER", label: "Oral or poster" },
] as const;

type PresentationDraft = { code: string; label: string; isActive: boolean };

/** All three formats, in order, including any this event has no row for yet. */
function toPresentationDraft(types: PresentationTypeDto[]): PresentationDraft[] {
  return PRESENTATION_CODES.map(({ code, label }) => {
    const row = types.find((t) => t.code === code);
    return { code, label: row?.label ?? label, isActive: row?.isActive ?? false };
  });
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
  const [builderType, setBuilderType] = useState<SubmissionTypeDto | null>(null);
  const [name, setName] = useState("");
  const [wordLimit, setWordLimit] = useState("300");
  const [requiresErc, setRequiresErc] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; wordLimit?: string }>({});
  const [deleteTarget, setDeleteTarget] = useState<SubmissionTypeDto | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [presentationDraft, setPresentationDraft] = useState<PresentationDraft[]>(() => toPresentationDraft([]));
  const [presentationError, setPresentationError] = useState<string | null>(null);
  const [presentationSaving, setPresentationSaving] = useState(false);

  const load = useCallback(async () => {
    const [typesRes, presRes] = await Promise.all([
      apiFetch<SubmissionTypeDto[]>(`${base}/submission-types`),
      apiFetch<PresentationTypeDto[]>(`${base}/presentation-types`),
    ]);

    if (typesRes.ok) {
      setTypes(typesRes.data);
      setLoadError(null);
    } else {
      setLoadError(typesRes.error.message || "The submission types couldn't be loaded.");
    }

    if (presRes.ok) {
      setPresentationTypes(presRes.data);
      setPresentationDraft(toPresentationDraft(presRes.data));
    } else toast.error("Couldn't load presentation types", { description: presRes.error.message });

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
    setFieldErrors({});
    setEditOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setWordLimit("300");
    setRequiresErc(false);
    setFieldErrors({});
    setEditOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const result = await apiFetch(`${base}/submission-types/${deleteTarget.id}`, { method: "DELETE" });
      if (!result.ok) {
        toast.error("Couldn't delete this type", { description: result.error.message });
        setDeleteTarget(null);
        return;
      }
      toast.success("Submission type deleted");
      setDeleteTarget(null);
      await load();
    } finally {
      setDeleteLoading(false);
    }
  }

  async function savePresentationTypes() {
    if (presentationDraft.some((p) => !p.label.trim())) {
      setPresentationError("Give every format a name.");
      return;
    }
    if (!presentationDraft.some((p) => p.isActive)) {
      setPresentationError("Keep at least one format on.");
      return;
    }
    setPresentationError(null);
    setPresentationSaving(true);
    try {
      const result = await apiFetch<PresentationTypeDto[]>(`${base}/presentation-types`, {
        method: "PUT",
        body: {
          types: presentationDraft.map((p, sortOrder) => ({
            code: p.code,
            label: p.label.trim(),
            isActive: p.isActive,
            sortOrder,
          })),
        },
      });
      if (!result.ok) {
        toast.error("Couldn't save presentation types", { description: result.error.message });
        return;
      }
      setPresentationTypes(result.data);
      setPresentationDraft(toPresentationDraft(result.data));
      toast.success("Presentation types saved");
    } finally {
      setPresentationSaving(false);
    }
  }

  async function saveType() {
    const trimmed = name.trim();
    const limit = Number.parseInt(wordLimit, 10);
    const errors: { name?: string; wordLimit?: string } = {};
    if (!trimmed) errors.name = "Enter a name, e.g. Original research.";
    if (!Number.isFinite(limit) || limit <= 0) errors.wordLimit = "Enter a whole number above 0, e.g. 300.";
    setFieldErrors(errors);
    if (errors.name || errors.wordLimit) return;

    setSaveLoading(true);
    try {
      const result = editing
        ? await apiFetch<SubmissionTypeDto>(`${base}/submission-types/${editing.id}`, {
            method: "PATCH",
            body: { name: trimmed, wordLimit: limit, requiresErc },
          })
        : await apiFetch<SubmissionTypeDto>(`${base}/submission-types`, {
            method: "POST",
            body: {
              name: trimmed,
              wordLimit: limit,
              requiresErc,
              sortOrder: types.reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1,
            },
          });
      if (!result.ok) {
        toast.error("Couldn't save the submission type", { description: result.error.message });
        return;
      }
      toast.success(editing ? "Submission type saved" : "Submission type added");
      setEditOpen(false);
      await load();
    } finally {
      setSaveLoading(false);
    }
  }

  const presentationDirty =
    JSON.stringify(presentationDraft) !== JSON.stringify(toPresentationDraft(presentationTypes));

  const addTypeButton = (
    <Button type="button" onClick={openCreate}>
      <Plus data-icon="inline-start" />
      Add type
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Submission types"
        description="Each type has its own form and word limit. Authors pick one when they submit."
        actions={addTypeButton}
      />

      {loading ? (
        <CardListSkeleton count={2} label="Loading submission types…" />
      ) : loadError ? (
        <ErrorState
          title="Submission types didn't load"
          description={loadError}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : types.length === 0 ? (
        <EmptyState
          icon={TypesIcon}
          title="No submission types yet"
          description="Add the types authors can submit, such as Original research or Case report."
          action={addTypeButton}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {types.map((type) => {
            const sections = parseSections(type.sections);
            return (
              <li key={type.id} className="flex flex-col rounded-lg border border-border bg-card">
                <div className="flex items-start justify-between gap-3 p-4 md:p-5">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{type.name}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        Up to <strong className="font-semibold text-foreground tabular-nums">{type.wordLimit}</strong> words
                      </span>
                      {type.requiresErc ? (
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="size-4 text-brand-ink" aria-hidden />
                          Ethics approval required
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(type)}>
                      <Pencil data-icon="inline-start" />
                      Edit<span className="sr-only"> {type.name}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${type.name}`}
                      onClick={() => setDeleteTarget(type)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 border-t border-border px-4 py-4 md:px-5">
                  <p className="mb-2 text-sm text-muted-foreground">
                    Abstract sections ({sections.length})
                  </p>
                  {sections.length ? (
                    <ol className="flex flex-wrap gap-1.5">
                      {sections.map((section, i) => (
                        <li key={section.key} className="rounded-md border border-border bg-surface px-2.5 py-1 text-sm">
                          <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {section.label}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-warning-foreground">No sections yet — add them in the form builder.</p>
                  )}
                </div>
                <div className="border-t border-border p-3 md:px-5">
                  <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setBuilderType(type)}>
                    <Layers data-icon="inline-start" />
                    Edit form and sections
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section id="presentation-types" aria-labelledby="presentation-types-title" className="mt-12 scroll-mt-24">
        <h2 id="presentation-types-title" className="font-heading text-2xl font-semibold">
          Presentation types
        </h2>
        <p className="mt-1 max-w-[65ch] text-base text-muted-foreground">
          The formats authors can ask for. Turning one off hides it for new choices; existing abstracts keep theirs.
        </p>
        <ul className="mt-4 grid gap-3">
          {presentationDraft.map((ptype, index) => (
            <li key={ptype.code} className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
              <Input
                aria-label={`Name for ${PRESENTATION_CODES[index]!.label} format`}
                value={ptype.label}
                maxLength={100}
                onChange={(e) =>
                  setPresentationDraft((draft) =>
                    draft.map((p, i) => (i === index ? { ...p, label: e.target.value } : p)),
                  )
                }
              />
              <Switch
                aria-label={`${ptype.label || PRESENTATION_CODES[index]!.label} offered to authors`}
                checked={ptype.isActive}
                onCheckedChange={(isActive) =>
                  setPresentationDraft((draft) =>
                    draft.map((p, i) => (i === index ? { ...p, isActive } : p)),
                  )
                }
              />
            </li>
          ))}
        </ul>
        {presentationError ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger-foreground">{presentationError}</p>
        ) : null}
        <Button
          type="button"
          className="mt-4 w-full sm:w-auto"
          disabled={presentationSaving || !presentationDirty}
          onClick={() => void savePresentationTypes()}
        >
          {presentationSaving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {presentationSaving ? "Saving…" : "Save presentation types"}
        </Button>
      </section>

      <SidePanel
        open={editOpen}
        onOpenChange={(o) => (saveLoading ? null : setEditOpen(o))}
        title={editing ? `Edit ${editing.name}` : "Add submission type"}
        description={editing ? "Name, word limit and ethics requirement. Change sections in the form builder." : "New types start with the standard IMRaD sections. Change them in the form builder."}
        footer={
          <>
            <Button variant="outline" disabled={saveLoading} onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saveLoading} onClick={() => void saveType()}>
              {saveLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {saveLoading ? "Saving…" : editing ? "Save submission type" : "Add submission type"}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <FormField label="Name" required error={fieldErrors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Word limit" required error={fieldErrors.wordLimit} help="Counted across all abstract sections.">
            <Input type="number" inputMode="numeric" min={1} className="max-w-40" value={wordLimit} onChange={(e) => setWordLimit(e.target.value)} />
          </FormField>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
            <div>
              <Label htmlFor="stype-erc" className="text-base font-medium">Ethics approval required</Label>
              <p className="text-sm text-muted-foreground">Authors must give their ethics review committee (ERC) details when they submit.</p>
            </div>
            <Switch id="stype-erc" checked={requiresErc} onCheckedChange={setRequiresErc} />
          </div>
        </div>
      </SidePanel>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this submission type?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” and its form will be deleted. Types that already have submissions can't be deleted.`
            : "This type will be deleted."
        }
        confirmLabel="Delete type"
        destructive
        loading={deleteLoading}
        onConfirm={confirmDelete}
      />

      <FormBuilderDialog
        open={!!builderType}
        onOpenChange={(open) => !open && setBuilderType(null)}
        submissionType={builderType}
        orgId={orgId}
        eventId={eventId}
        onUpdated={load}
      />
    </div>
  );
}
