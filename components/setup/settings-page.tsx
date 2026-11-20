"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Lock } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EventDate } from "@/components/shared/event-date";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brandForeground, contrastRatio, DEFAULT_BRAND, isValidBrandColor } from "@/lib/theme/brand";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { EventIcons } from "@/lib/events/icons";
import type {
  DeadlineExtensionDto,
  EventDto,
  EventRoleDto,
} from "@/lib/types/api";

function toKebabSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function readEmailSenderName(settings: Record<string, unknown>): string {
  const raw = settings.emailSenderName;
  return typeof raw === "string" ? raw : "";
}

type CloneResponse = { event: EventDto };

export function SettingsPage({
  orgId,
  orgSlug,
  eventId,
  event,
}: {
  orgId: string;
  orgSlug: string;
  eventId: string;
  event: EventDto;
}) {
  const router = useRouter();
  const CloneIcon = EventIcons.clone;
  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;

  const [emailSenderName, setEmailSenderName] = useState(() =>
    readEmailSenderName(event.settings),
  );
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [savedSender, setSavedSender] = useState(() => readEmailSenderName(event.settings));
  const [brandColor, setBrandColor] = useState(event.primaryColor ?? "");
  const [savedColor, setSavedColor] = useState(event.primaryColor ?? "");
  const [colorSaving, setColorSaving] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);
  const [cloneErrors, setCloneErrors] = useState<{ name?: string; slug?: string }>({});
  const [extErrors, setExtErrors] = useState<{ submitter?: string; until?: string }>({});

  const [extensions, setExtensions] = useState<DeadlineExtensionDto[]>([]);
  const [roles, setRoles] = useState<EventRoleDto[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [extendOpen, setExtendOpen] = useState(false);
  const [submitterUserId, setSubmitterUserId] = useState("");
  const [extendsUntil, setExtendsUntil] = useState("");
  const [reason, setReason] = useState("");
  const [extendLoading, setExtendLoading] = useState(false);

  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneSlugTouched, setCloneSlugTouched] = useState(false);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneForm, setCloneForm] = useState({
    name: `${event.name} (copy)`,
    slug: toKebabSlug(`${event.name} (copy)`),
    edition: event.edition ?? "",
  });

  const submitters = useMemo(
    () => roles.filter((r) => r.role === "SUBMITTER"),
    [roles],
  );

  const submitterLabel = useCallback(
    (userId: string) => {
      const role = submitters.find((r) => r.userId === userId);
      if (!role) return userId;
      return role.user.fullName?.trim() || role.user.email;
    },
    [submitters],
  );

  const loadAux = useCallback(async () => {
    const [extRes, rolesRes] = await Promise.all([
      apiFetch<DeadlineExtensionDto[]>(`${base}/deadline-extensions`),
      apiFetch<EventRoleDto[]>(`${base}/roles`),
    ]);
    if (extRes.ok) setExtensions(extRes.data);
    if (rolesRes.ok) setRoles(rolesRes.data);
    setSettingsLoading(false);
  }, [base]);

  useEffect(() => {
    void loadAux();
  }, [loadAux]);

  function openCloneDialog() {
    const name = `${event.name} (copy)`;
    setCloneForm({
      name,
      slug: toKebabSlug(name),
      edition: event.edition ?? "",
    });
    setCloneSlugTouched(false);
    setCloneErrors({});
    setCloneOpen(true);
  }

  function handleCloneNameChange(name: string) {
    setCloneForm((prev) => ({
      ...prev,
      name,
      slug: cloneSlugTouched ? prev.slug : toKebabSlug(name),
    }));
  }

  async function submitClone() {
    const name = cloneForm.name.trim();
    const slug = cloneForm.slug.trim();
    const errors: { name?: string; slug?: string } = {};
    if (!name) errors.name = "Enter the new event's name.";
    if (!slug || slug.length < 2) errors.slug = "Use at least 2 characters: lowercase letters, numbers and hyphens.";
    setCloneErrors(errors);
    if (errors.name || errors.slug) return;

    setCloneLoading(true);
    try {
      const edition = cloneForm.edition.trim();
      const result = await apiFetch<CloneResponse>(`${base}/clone`, {
        method: "POST",
        body: {
          name,
          slug,
          edition: edition || null,
        },
      });
      if (!result.ok) {
        toast.error("Couldn't clone the event", { description: result.error.message });
        return;
      }
      toast.success("Event cloned", "Review its key dates before opening submissions.");
      setCloneOpen(false);
      router.push(
        `/org/${orgSlug}/events/${result.data.event.slug}/dashboard`,
      );
      router.refresh();
    } finally {
      setCloneLoading(false);
    }
  }

  async function saveBranding() {
    setBrandingLoading(true);
    try {
      const nextSettings = {
        ...event.settings,
        emailSenderName: emailSenderName.trim() || null,
      };
      const result = await apiFetch<EventDto>(base, {
        method: "PATCH",
        body: { settings: nextSettings },
      });
      if (!result.ok) {
        toast.error("Couldn't save the sender name", { description: result.error.message });
        return;
      }
      toast.success("Sender name saved");
      setSavedSender(emailSenderName);
    } finally {
      setBrandingLoading(false);
    }
  }

  async function submitExtension() {
    const errors: { submitter?: string; until?: string } = {};
    if (!submitterUserId) errors.submitter = "Choose who gets the extension.";
    if (!extendsUntil) errors.until = "Choose the new deadline.";
    setExtErrors(errors);
    if (errors.submitter || errors.until) return;
    const until = new Date(extendsUntil);
    if (Number.isNaN(until.getTime())) {
      setExtErrors({ until: "That date isn't valid. Pick it from the calendar." });
      return;
    }

    setExtendLoading(true);
    try {
      const result = await apiFetch<DeadlineExtensionDto>(
        `${base}/deadline-extensions`,
        {
          method: "POST",
          body: {
            submitterUserId,
            extendsUntil: until.toISOString(),
            reason: reason.trim() || null,
          },
        },
      );
      if (!result.ok) {
        toast.error("Couldn't add the extension", { description: result.error.message });
        return;
      }
      toast.success("Deadline extended", `${submitterLabel(submitterUserId)} has until the new date.`);
      setExtendOpen(false);
      setSubmitterUserId("");
      setExtendsUntil("");
      setReason("");
      await loadAux();
    } finally {
      setExtendLoading(false);
    }
  }

  /** Brand colour (GEN-02) — saves the existing `primaryColor` event field. */
  async function saveBrandColor(next: string | null) {
    if (next && !isValidBrandColor(next)) {
      setColorError("Use a hex colour like #0f6e6a.");
      return;
    }
    setColorError(null);
    setColorSaving(true);
    try {
      const result = await apiFetch<EventDto>(base, { method: "PATCH", body: { primaryColor: next } });
      if (!result.ok) {
        toast.error("Couldn't save the brand colour", { description: result.error.message });
        return;
      }
      setSavedColor(next ?? "");
      setBrandColor(next ?? "");
      toast.success(next ? "Brand colour saved" : "Brand colour reset to default");
      router.refresh();
    } finally {
      setColorSaving(false);
    }
  }

  const previewColor = isValidBrandColor(brandColor) ? brandColor : DEFAULT_BRAND;
  const previewText = brandForeground(previewColor);
  const ratio = contrastRatio(previewColor, previewText);

  const extColumns: DataTableColumn<DeadlineExtensionDto>[] = [
    { id: "who", header: "Author", mobile: "title", cell: (e) => <span className="font-medium">{submitterLabel(e.submitterUserId)}</span> },
    { id: "until", header: "New deadline", cell: (e) => <EventDate value={e.extendsUntil} includeTime /> },
    { id: "reason", header: "Reason", cell: (e) => e.reason || <span className="text-muted-foreground">—</span> },
  ];

  return (
    <div>
      <PageHeader title="Settings" description="Per-author deadline extensions, cloning and branding." />

      <div className="max-w-4xl space-y-8">
        <section aria-labelledby="ext-title" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="ext-title" className="font-heading text-2xl font-semibold">Deadline extensions</h2>
              <p className="mt-1 max-w-[60ch] text-base text-muted-foreground">
                Give one author more time without reopening the call for everyone.
              </p>
            </div>
            <Button type="button" onClick={() => { setExtErrors({}); setExtendOpen(true); }}>
              <CalendarPlus data-icon="inline-start" />
              Extend a deadline
            </Button>
          </div>
          <DataTable
            caption="Deadline extensions"
            columns={extColumns}
            rows={extensions}
            getRowId={(e) => e.id}
            loading={settingsLoading}
            empty={{ title: "No extensions", description: "Everyone has the same submission deadline." }}
          />
        </section>

        <FormSection
          title="Brand colour"
          description="Buttons, links and highlights on the public page and portal use this colour."
          footer={
            <>
              <Button type="button" variant="outline" disabled={colorSaving || !savedColor} onClick={() => void saveBrandColor(null)}>
                Use default teal
              </Button>
              <Button type="button" disabled={colorSaving || brandColor === savedColor} onClick={() => void saveBrandColor(brandColor.trim() || null)}>
                {colorSaving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                {colorSaving ? "Saving…" : "Save colour"}
              </Button>
            </>
          }
        >
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
            <FormField label="Colour" optional error={colorError} help="Pick it, or paste the hex code from your college's logo.">
              {(p) => (
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={previewColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    aria-label="Pick brand colour"
                    className="size-control shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                  <Input
                    {...p}
                    value={brandColor}
                    placeholder={DEFAULT_BRAND}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="font-mono"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
              )}
            </FormField>
            <div className="rounded-md border border-border p-4">
              <p className="mb-3 text-sm text-muted-foreground">Preview</p>
              <span
                className="inline-flex h-control items-center rounded-md px-4 text-base font-medium"
                style={{ background: previewColor, color: previewText }}
              >
                Submit abstract
              </span>
              <p className="mt-3 text-sm text-muted-foreground">
                Text on this colour: {previewText === "#ffffff" ? "white" : "dark"} · contrast {ratio.toFixed(1)}:1
                {ratio < 4.5 ? " — too low; choose a darker colour." : ""}
              </p>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Email sender"
          description="The name authors see in their inbox."
          footer={
            <Button type="button" disabled={brandingLoading || emailSenderName === savedSender} onClick={() => void saveBranding()}>
              {brandingLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {brandingLoading ? "Saving…" : "Save sender name"}
            </Button>
          }
        >
          <FormField label="Sender name" optional help="e.g. SLMA Scientific Sessions">
            <Input value={emailSenderName} onChange={(e) => setEmailSenderName(e.target.value)} />
          </FormField>
          <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
            <div>
              <p className="flex items-center gap-2 text-base font-medium">
                <Lock className="size-4 text-muted-foreground" aria-hidden />
                “Powered by DocLink” footer
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Always shown on emails and the public portal in this version.</p>
            </div>
            <Switch checked disabled aria-label="Powered by DocLink footer (always on)" />
          </div>
        </FormSection>

        <FormSection
          title="Clone for next year"
          description="Start next year's event from this one's settings, forms, submission types and eligibility rules. Submissions and the reviewer pool aren't copied."
          footer={
            <Button type="button" variant="outline" onClick={openCloneDialog}>
              <CloneIcon data-icon="inline-start" />
              Clone this event…
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">You&apos;ll go to the new event when it&apos;s ready.</p>
        </FormSection>
      </div>

      <SidePanel
        open={cloneOpen}
        onOpenChange={(o) => (cloneLoading ? null : setCloneOpen(o))}
        title="Clone event"
        description={<>A copy of <strong className="font-semibold text-foreground">{event.name}</strong> without submissions.</>}
        footer={
          <>
            <Button variant="outline" disabled={cloneLoading} onClick={() => setCloneOpen(false)}>Cancel</Button>
            <Button disabled={cloneLoading} onClick={() => void submitClone()}>
              {cloneLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {cloneLoading ? "Cloning…" : "Clone event"}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <FormField label="New event name" required error={cloneErrors.name}>
            <Input value={cloneForm.name} onChange={(e) => handleCloneNameChange(e.target.value)} />
          </FormField>
          <FormField label="Edition" optional>
            <Input value={cloneForm.edition} onChange={(e) => setCloneForm((prev) => ({ ...prev, edition: e.target.value }))} />
          </FormField>
          <FormField
            label="Web address"
            required
            error={cloneErrors.slug}
            help={<>Public page: <span className="font-mono text-foreground">/{orgSlug}/{cloneForm.slug || "…"}</span></>}
          >
            <Input
              value={cloneForm.slug}
              onChange={(e) => {
                setCloneSlugTouched(true);
                setCloneForm((prev) => ({ ...prev, slug: e.target.value }));
              }}
              className="font-mono"
              autoCapitalize="none"
              spellCheck={false}
            />
          </FormField>
        </div>
      </SidePanel>

      <SidePanel
        open={extendOpen}
        onOpenChange={(o) => (extendLoading ? null : setExtendOpen(o))}
        title="Extend a deadline"
        description="Only this author can submit after the main deadline, until the date you choose."
        footer={
          <>
            <Button variant="outline" disabled={extendLoading} onClick={() => setExtendOpen(false)}>Cancel</Button>
            <Button disabled={extendLoading} onClick={() => void submitExtension()}>
              {extendLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {extendLoading ? "Saving…" : "Extend deadline"}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <FormField
            label="Author"
            required
            error={extErrors.submitter}
            help={submitters.length === 0 ? "No one has started a submission yet, so there's no one to choose." : "People who have started a submission."}
          >
            {(p) => (
              <Select value={submitterUserId} onValueChange={setSubmitterUserId}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue placeholder="Choose an author" />
                </SelectTrigger>
                <SelectContent>
                  {submitters.length === 0 ? (
                    <SelectItem value="none" disabled>No authors yet</SelectItem>
                  ) : (
                    submitters.map((role) => (
                      <SelectItem key={role.userId} value={role.userId}>
                        {role.user.fullName?.trim() || role.user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="New deadline" required error={extErrors.until}>
            <Input type="datetime-local" className="sm:max-w-xs" value={extendsUntil} onChange={(e) => setExtendsUntil(e.target.value)} />
          </FormField>
          <FormField label="Reason" optional help="Kept with the audit log, e.g. “Ethics approval delayed”.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </FormField>
        </div>
      </SidePanel>
    </div>
  );
}
