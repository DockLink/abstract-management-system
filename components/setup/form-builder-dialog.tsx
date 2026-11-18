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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api/client";
import { toast } from "sonner";
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
  Layers,
} from "lucide-react";
import type { FormFieldDto, FormFieldType, SubmissionTypeDto } from "@/lib/types/api";

const FIELD_TYPES: Array<{ value: FormFieldType; label: string; icon: React.ElementType }> = [
  { value: "TEXT", label: "Short Text", icon: FileText },
  { value: "LONG_TEXT", label: "Long Text / Textarea", icon: FileText },
  { value: "DROPDOWN", label: "Dropdown Select", icon: List },
  { value: "RADIO", label: "Single Choice (Radio)", icon: CheckSquare },
  { value: "CHECKBOX", label: "Multiple Choice (Checkbox)", icon: CheckSquare },
  { value: "NUMBER", label: "Number", icon: Hash },
  { value: "DATE", label: "Date", icon: Calendar },
  { value: "FILE_UPLOAD", label: "File Upload", icon: UploadCloud },
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

  const base = `/api/v1/orgs/${orgId}/events/${eventId}/submission-types/${submissionType?.id}`;

  const loadFields = useCallback(async () => {
    if (!submissionType) return;
    setLoading(true);
    try {
      const res = await apiFetch<FormFieldDto[]>(`${base}/form-fields`);
      if (res.ok) {
        setFields(res.data);
      } else {
        toast.error(res.error.message || "Failed to load custom form fields");
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
      toast.error("A section with this key already exists");
      return;
    }
    setSections([...sections, { key, label: trimmed }]);
    setNewSectionLabel("");
  }

  function removeSection(idx: number) {
    if (sections.length <= 1) {
      toast.error("At least one section is required");
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
        toast.error(res.error.message || "Failed to save sections");
        return;
      }
      toast.success("Abstract sections updated");
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
      toast.error("Field label is required");
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
      toast.error("Please provide comma-separated options for this choice field");
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
          toast.error(res.error.message || "Failed to update field");
          return;
        }
        toast.success("Field updated");
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
          toast.error(res.error.message || "Failed to create field");
          return;
        }
        toast.success("Field created");
      }

      setFieldModalOpen(false);
      await loadFields();
    } finally {
      setFieldSaving(false);
    }
  }

  async function deleteField(fieldId: string) {
    if (!confirm("Are you sure you want to delete this field?")) return;
    const res = await apiFetch(`${base}/form-fields/${fieldId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(res.error.message || "Failed to delete field");
      return;
    }
    toast.success("Field deleted");
    await loadFields();
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <span>Form Builder — {submissionType?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Configure the structured abstract sections and any custom fields authors must fill out.
            </DialogDescription>
          </DialogHeader>

          {/* Tab Switcher */}
          <div className="flex border-b border-border gap-4 mt-2">
            <button
              type="button"
              onClick={() => setActiveTab("sections")}
              className={`pb-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "sections"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Abstract Sections ({sections.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("custom_fields")}
              className={`pb-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "custom_fields"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Custom Form Fields ({fields.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {activeTab === "sections" ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Default sections follow the IMRaD format (Introduction, Objectives, Methods, Results, Conclusions). You can rename or add sections for specific types (e.g. Case Reports).
                </p>

                <div className="space-y-2">
                  {sections.map((section, idx) => (
                    <div
                      key={section.key}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/20"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-sm text-foreground truncate">
                          {section.label}
                        </span>
                        <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {section.key}
                        </code>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, "up")}
                          title="Move up"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={idx === sections.length - 1}
                          onClick={() => moveSection(idx, "down")}
                          title="Move down"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:bg-destructive/10"
                          onClick={() => removeSection(idx)}
                          title="Remove section"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Input
                    placeholder="New section title (e.g. Case Discussion)"
                    value={newSectionLabel}
                    onChange={(e) => setNewSectionLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSection();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" onClick={addSection} className="shrink-0">
                    <Plus className="size-4 mr-1" />
                    Add Section
                  </Button>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="button"
                    onClick={saveSections}
                    disabled={sectionsSaving}
                    className="px-6"
                  >
                    {sectionsSaving ? "Saving…" : "Save Sections"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Custom fields to capture specific questions (e.g. Funding Source, Study Design, File Uploads).
                  </p>
                  <Button type="button" size="sm" onClick={openCreateField} className="gap-1">
                    <Plus className="size-3.5" />
                    Add Field
                  </Button>
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading custom fields…</p>
                ) : fields.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                    <p className="text-sm font-medium">No custom form fields yet</p>
                    <p className="text-xs mt-1">Authors will only fill standard sections, authors, and declarations.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, idx) => {
                      const TypeObj = FIELD_TYPES.find((t) => t.value === field.type);
                      const Icon = TypeObj?.icon || FileText;
                      return (
                        <div
                          key={field.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-white"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Icon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{field.label}</span>
                                {field.required ? (
                                  <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                    Required
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                    Optional
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>{TypeObj?.label || field.type}</span>
                                {field.options && field.options.length > 0 ? (
                                  <span>· {field.options.length} options</span>
                                ) : null}
                                {field.helpText ? <span>· {field.helpText}</span> : null}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={idx === 0}
                              onClick={() => moveField(idx, "up")}
                              title="Move up"
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={idx === fields.length - 1}
                              onClick={() => moveField(idx, "down")}
                              title="Move down"
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => openEditField(field)}
                              title="Edit field"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:bg-destructive/10"
                              onClick={() => deleteField(field.id)}
                              title="Delete field"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Create/Edit Modal */}
      <Dialog open={fieldModalOpen} onOpenChange={setFieldModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>{editingField ? "Edit Field" : "Add Form Field"}</DialogTitle>
            <DialogDescription>
              Configure label, input type, options, and validation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="fieldLabel">Field Label *</Label>
              <Input
                id="fieldLabel"
                placeholder="e.g. Funding Source"
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fieldType">Field Type</Label>
              <Select value={fieldType} onValueChange={(val) => setFieldType(val as FormFieldType)}>
                <SelectTrigger id="fieldType">
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
            </div>

            {["DROPDOWN", "RADIO", "CHECKBOX"].includes(fieldType) ? (
              <div className="space-y-1.5">
                <Label htmlFor="fieldOptions">Options (comma-separated) *</Label>
                <Input
                  id="fieldOptions"
                  placeholder="Option 1, Option 2, Option 3"
                  value={fieldOptions}
                  onChange={(e) => setFieldOptions(e.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="fieldHelpText">Help Text (optional)</Label>
              <Input
                id="fieldHelpText"
                placeholder="Guidance displayed beneath the input"
                value={fieldHelpText}
                onChange={(e) => setFieldHelpText(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="fieldRequired" className="font-medium text-sm">
                  Required field
                </Label>
                <p className="text-xs text-muted-foreground">
                  Authors cannot submit without filling this field.
                </p>
              </div>
              <Switch
                id="fieldRequired"
                checked={fieldRequired}
                onCheckedChange={setFieldRequired}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFieldModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveField} disabled={fieldSaving}>
              {fieldSaving ? "Saving…" : editingField ? "Save Changes" : "Create Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

