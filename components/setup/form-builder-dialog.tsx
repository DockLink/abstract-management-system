"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api/client";
import { toast } from "@/components/shared/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { SidePanel } from "@/components/shared/side-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  FileText,
  CheckSquare,
  List,
  UploadCloud,
  Hash,
  Calendar,
  Loader2,
} from "lucide-react";
import type { FormFieldDto, FormFieldType, SubmissionTypeDto } from "@/lib/types/api";

const FIELD_TYPES: Array<{ value: FormFieldType; label: string; icon: React.ElementType }> = [
  { value: "TEXT", label: "Short text", icon: FileText },
  { value: "LONG_TEXT", label: "Long text", icon: FileText },
  { value: "DROPDOWN", label: "Dropdown", icon: List },
  { value: "RADIO", label: "Single choice (radio)", icon: CheckSquare },
  { value: "CHECKBOX", label: "Multiple choice (checkboxes)", icon: CheckSquare },
  { value: "NUMBER", label: "Number", icon: Hash },
  { value: "DATE", label: "Date", icon: Calendar },
  { value: "FILE_UPLOAD", label: "File upload", icon: UploadCloud },
];

export function FormBuilderDialog({
  open,
  onOpenChange,
  submissionType,
  orgId,
  eventId,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionType: SubmissionTypeDto | null;
  orgId: string;
  eventId: string;
  onUpdated: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"sections" | "custom_fields">("sections");

  // Sections State (SUB-02)
  const [sections, setSections] = useState<Array<{ key: string; label: string }>>([]);
  const [newSectionLabel, setNewSectionLabel] = useState("");
  const [sectionsSaving, setSectionsSaving] = useState(false);

  // Form Fields State (SUB-01)
  const [fields, setFields] = useState<FormFieldDto[]>([]);
  const [loading, setLoading] = useState(false);

  // Field Add/Edit Dialog State
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormFieldDto | null>(null);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<FormFieldType>("TEXT");
  const [fieldHelpText, setFieldHelpText] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState("");
  const [fieldSaving, setFieldSaving] = useState(false);
  const [deleteFieldTarget, setDeleteFieldTarget] = useState<FormFieldDto | null>(null);
  const [deletingField, setDeletingField] = useState(false);

  const base = `/api/v1/orgs/${orgId}/events/${eventId}/submission-types/${submissionType?.id}`;

  const loadFields = useCallback(async () => {
    if (!submissionType) return;
    setLoading(true);
    try {
      const res = await apiFetch<FormFieldDto[]>(`${base}/form-fields`);
      if (res.ok) {
        setFields(res.data);
      } else {
        toast.error("Couldn't load custom fields", { description: res.error.message });
      }
    } finally {
      setLoading(false);
    }
  }, [base, submissionType]);

  useEffect(() => {
    if (open && submissionType) {
      // Initialize sections
      const initialSections = Array.isArray(submissionType.sections)
        ? submissionType.sections.map((s) => ({ key: s.key, label: s.label }))
        : [];
      setSections(initialSections);
      void loadFields();
    }
  }, [open, submissionType, loadFields]);

  // --- Sections handlers (SUB-02) ---
  function addSection() {
    const trimmed = newSectionLabel.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/[^\w]/g, "_");
    if (sections.some((s) => s.key === key)) {
      toast.error("That section already exists", { description: "Give it a different name." });
      return;
    }
    setSections([...sections, { key, label: trimmed }]);
    setNewSectionLabel("");
  }

  function removeSection(idx: number) {
    if (sections.length <= 1) {
      toast.error("Keep at least one section", { description: "Every abstract needs a body." });
      return;
    }
    setSections(sections.filter((_, i) => i !== idx));
  }

  function moveSection(idx: number, dir: "up" | "down") {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const temp = next[idx]!;
    next[idx] = next[target]!;
    next[target] = temp;
    setSections(next);
  }

  async function saveSections() {
    if (!submissionType) return;
    setSectionsSaving(true);
    try {
      const res = await apiFetch(`${base}`, {
        method: "PATCH",
        body: { sections },
      });
      if (!res.ok) {
        toast.error("Couldn't save the sections", { description: res.error.message });
        return;
      }
      toast.success("Sections saved");
      onUpdated();
    } finally {
      setSectionsSaving(false);
    }
  }

  // --- Form fields handlers (SUB-01) ---
  function openCreateField() {
    setEditingField(null);
    setFieldLabel("");
    setFieldType("TEXT");
    setFieldHelpText("");
    setFieldRequired(false);
    setFieldOptions("");
    setFieldModalOpen(true);
  }

  function openEditField(f: FormFieldDto) {
    setEditingField(f);
    setFieldLabel(f.label);
    setFieldType(f.type);
    setFieldHelpText(f.helpText || "");
    setFieldRequired(f.required);
    setFieldOptions(f.options ? f.options.join(", ") : "");
    setFieldModalOpen(true);
  }

  async function saveField() {
    if (!submissionType) return;
    const trimmedLabel = fieldLabel.trim();
    if (!trimmedLabel) {
      toast.error("Enter a label for the field");
      return;
    }

    const needsOptions = ["DROPDOWN", "RADIO", "CHECKBOX"].includes(fieldType);
    const parsedOptions = needsOptions
      ? fieldOptions
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : null;

    if (needsOptions && (!parsedOptions || parsedOptions.length === 0)) {
      toast.error("Add the choices", { description: "Separate them with commas, e.g. Yes, No, Not sure." });
      return;
    }

    setFieldSaving(true);
    try {
      if (editingField) {
        const res = await apiFetch<FormFieldDto>(`${base}/form-fields/${editingField.id}`, {
          method: "PATCH",
          body: {
            label: trimmedLabel,
            type: fieldType,
            helpText: fieldHelpText.trim() || null,
            required: fieldRequired,
            options: parsedOptions,
          },
        });
        if (!res.ok) {
          toast.error("Couldn't save the field", { description: res.error.message });
          return;
        }
        toast.success("Field saved");
      } else {
        const res = await apiFetch<FormFieldDto>(`${base}/form-fields`, {
          method: "POST",
          body: {
            label: trimmedLabel,
            type: fieldType,
            helpText: fieldHelpText.trim() || null,
            required: fieldRequired,
            options: parsedOptions,
          },
        });
        if (!res.ok) {
          toast.error("Couldn't add the field", { description: res.error.message });
          return;
        }
        toast.success("Field added");
      }

      setFieldModalOpen(false);
      await loadFields();
    } finally {
      setFieldSaving(false);
    }
  }

  /** Same DELETE as before; the confirmation is now a ConfirmDialog instead of window.confirm. */
  async function deleteField(fieldId: string) {
    setDeletingField(true);
    try {
      const res = await apiFetch(`${base}/form-fields/${fieldId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Couldn't delete the field", { description: res.error.message });
        return;
      }
      toast.success("Field deleted");
      setDeleteFieldTarget(null);
      await loadFields();
    } finally {
      setDeletingField(false);
    }
  }

  async function moveField(idx: number, dir: "up" | "down") {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    const temp = next[idx]!;
    next[idx] = next[target]!;
    next[target] = temp;
    setFields(next);

    const orderedIds = next.map((f) => f.id);
    await apiFetch(`${base}/form-fields/reorder`, {
      method: "POST",
      body: { orderedIds },
    });
  }

  const iconBtn = "text-muted-foreground";

  return (
    <>
      <SidePanel
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        title={`Form for ${submissionType?.name ?? "submission type"}`}
        description="The abstract sections authors write, plus any extra questions you need answered."
        footer={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        }
      >
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sections" | "custom_fields")}>
          <TabsList className="mb-4 h-auto w-full justify-start">
            <TabsTrigger value="sections" className="min-h-control-sm flex-1 sm:flex-none sm:px-4">
              Abstract sections ({sections.length})
            </TabsTrigger>
            <TabsTrigger value="custom_fields" className="min-h-control-sm flex-1 sm:flex-none sm:px-4">
              Extra questions ({fields.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sections" className="space-y-5">
            <p className="text-base text-muted-foreground">
              The default follows IMRaD (Introduction, Objectives, Methods, Results, Conclusions). Rename, reorder or add
              sections for types like case reports. Changes apply when you save.
            </p>

            <ol className="space-y-2">
              {sections.map((section, idx) => (
                <li key={section.key} className="flex items-center gap-3 rounded-md border border-border bg-card p-2 pl-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-base font-medium [overflow-wrap:anywhere]">{section.label}</span>
                  <span className="flex shrink-0 items-center">
                    <Button type="button" variant="ghost" size="icon-sm" className={iconBtn} disabled={idx === 0} onClick={() => moveSection(idx, "up")} aria-label={`Move ${section.label} up`}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" className={iconBtn} disabled={idx === sections.length - 1} onClick={() => moveSection(idx, "down")} aria-label={`Move ${section.label} down`}>
                      <ArrowDown />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="text-danger-foreground" onClick={() => removeSection(idx)} aria-label={`Remove ${section.label}`}>
                      <Trash2 />
                    </Button>
                  </span>
                </li>
              ))}
            </ol>

            <div className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label htmlFor="new-section" className="sr-only">New section title</label>
              <Input
                id="new-section"
                placeholder="New section, e.g. Case discussion"
                value={newSectionLabel}
                onChange={(e) => setNewSectionLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSection();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addSection}>
                <Plus data-icon="inline-start" />
                Add section
              </Button>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={saveSections} disabled={sectionsSaving} className="w-full sm:w-auto">
                {sectionsSaving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                {sectionsSaving ? "Saving…" : "Save sections"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="custom_fields" className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-base text-muted-foreground">
                Extra questions authors answer, such as funding source or study design.
              </p>
              <Button type="button" onClick={openCreateField} className="shrink-0">
                <Plus data-icon="inline-start" />
                Add question
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2" role="status">
                <span className="sr-only">Loading questions…</span>
                {[0, 1].map((k) => <div key={k} className="h-16 animate-pulse rounded-md bg-muted" />)}
              </div>
            ) : fields.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                <p className="text-base font-medium">No extra questions</p>
                <p className="mt-1 text-sm text-muted-foreground">Authors fill in the sections, authors and declarations only.</p>
              </div>
            ) : (
              <ol className="space-y-2">
                {fields.map((field, idx) => {
                  const TypeObj = FIELD_TYPES.find((t) => t.value === field.type);
                  const Icon = TypeObj?.icon || FileText;
                  return (
                    <li key={field.id} className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-medium [overflow-wrap:anywhere]">
                            {field.label}
                            <span className={field.required ? "ml-2 text-sm font-normal text-danger-foreground" : "ml-2 text-sm font-normal text-muted-foreground"}>
                              {field.required ? "Required" : "Optional"}
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {TypeObj?.label || field.type}
                            {field.options && field.options.length > 0 ? ` · ${field.options.length} choices` : ""}
                            {field.helpText ? ` · ${field.helpText}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-end">
                        <Button type="button" variant="ghost" size="icon-sm" className={iconBtn} disabled={idx === 0} onClick={() => moveField(idx, "up")} aria-label={`Move ${field.label} up`}>
                          <ArrowUp />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" className={iconBtn} disabled={idx === fields.length - 1} onClick={() => moveField(idx, "down")} aria-label={`Move ${field.label} down`}>
                          <ArrowDown />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" className={iconBtn} onClick={() => openEditField(field)} aria-label={`Edit ${field.label}`}>
                          <Pencil />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" className="text-danger-foreground" onClick={() => setDeleteFieldTarget(field)} aria-label={`Delete ${field.label}`}>
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </SidePanel>

      <Dialog open={fieldModalOpen} onOpenChange={setFieldModalOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{editingField ? "Edit question" : "Add a question"}</DialogTitle>
            <DialogDescription className="text-base">What authors see, how they answer, and whether it&apos;s required.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <FormField label="Question" required help="e.g. Funding source">
              <Input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} />
            </FormField>
            <FormField label="Answer type">
              {(p) => (
                <Select value={fieldType} onValueChange={(val) => setFieldType(val as FormFieldType)}>
                  <SelectTrigger {...p} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            {["DROPDOWN", "RADIO", "CHECKBOX"].includes(fieldType) ? (
              <FormField label="Choices" required help="Separate with commas, e.g. Yes, No, Not sure">
                <Input value={fieldOptions} onChange={(e) => setFieldOptions(e.target.value)} />
              </FormField>
            ) : null}
            <FormField label="Help text" optional help="Shown under the question.">
              <Input value={fieldHelpText} onChange={(e) => setFieldHelpText(e.target.value)} />
            </FormField>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
              <div>
                <Label htmlFor="fieldRequired" className="text-base font-medium">Required</Label>
                <p className="text-sm text-muted-foreground">Authors can&apos;t submit without answering.</p>
              </div>
              <Switch id="fieldRequired" checked={fieldRequired} onCheckedChange={setFieldRequired} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFieldModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveField} disabled={fieldSaving}>
              {fieldSaving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {fieldSaving ? "Saving…" : editingField ? "Save question" : "Add question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteFieldTarget}
        onOpenChange={(o) => !o && setDeleteFieldTarget(null)}
        title="Delete this question?"
        description={deleteFieldTarget ? `“${deleteFieldTarget.label}” will be removed from the submission form.` : ""}
        confirmLabel="Delete question"
        destructive
        loading={deletingField}
        onConfirm={() => deleteFieldTarget ? deleteField(deleteFieldTarget.id) : undefined}
      />
    </>
  );
}
