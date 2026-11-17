"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { EventDate } from "@/components/shared/event-date";
import { PageHeader } from "@/components/shared/page-header";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    if (!name) {
      toast.error("Event name is required");
      return;
    }
    if (!slug || slug.length < 2) {
      toast.error("Slug must be at least 2 characters (kebab-case)");
      return;
    }

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
        toast.error(result.error.message || "Could not clone event");
        return;
      }
      toast.success("Event cloned");
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
        toast.error(result.error.message || "Could not save branding");
        return;
      }
      toast.success("Email sender name saved");
    } finally {
      setBrandingLoading(false);
    }
  }

  async function submitExtension() {
    if (!submitterUserId) {
      toast.error("Select a submitter");
      return;
    }
    if (!extendsUntil) {
      toast.error("Extension date is required");
      return;
    }
    const until = new Date(extendsUntil);
    if (Number.isNaN(until.getTime())) {
      toast.error("Invalid date");
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
        toast.error(result.error.message || "Could not create extension");
        return;
      }
      toast.success("Deadline extension added");
      setExtendOpen(false);
      setSubmitterUserId("");
      setExtendsUntil("");
      setReason("");
      await loadAux();
    } finally {
      setExtendLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Clone this event, manage per-submitter deadlines, and branding."
      />

      <div className="flex flex-col gap-6">
        <Card className="border border-border bg-white">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Clone event</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Duplicate configuration for a new edition without copying
                submissions.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={openCloneDialog}
            >
              <CloneIcon />
              Clone
            </Button>
          </CardHeader>
        </Card>

        <Card className="border border-border bg-white">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Deadline extensions</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Grant individual submitters more time after the global close date.
              </p>
            </div>
            <Button
              type="button"
              className="h-10"
              onClick={() => setExtendOpen(true)}
            >
              <Plus className="size-4" />
              Extend deadline
            </Button>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : extensions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No extensions yet.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {extensions.map((ext) => (
                  <li
                    key={ext.id}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {submitterLabel(ext.submitterUserId)}
                      </p>
                      {ext.reason ? (
                        <p className="text-xs text-muted-foreground">
                          {ext.reason}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm">
                      Until{" "}
                      <EventDate value={ext.extendsUntil} includeTime />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border bg-white">
          <CardHeader>
            <CardTitle className="text-base">Branding</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 max-w-md">
              <Label htmlFor="email-sender">Email sender name</Label>
              <Input
                id="email-sender"
                className="h-10"
                placeholder="e.g. SLMA Scientific Sessions"
                value={emailSenderName}
                onChange={(e) => setEmailSenderName(e.target.value)}
              />
              <Button
                type="button"
                className="h-10 w-fit"
                disabled={brandingLoading}
                onClick={() => void saveBranding()}
              >
                {brandingLoading ? "Saving…" : "Save sender name"}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <div>
                <Label htmlFor="powered-by">Powered by DocLink</Label>
                <p className="text-xs text-muted-foreground">
                  Footer attribution on emails and the public portal.
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Switch id="powered-by" checked disabled />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Always enabled in v1 for DocLink platform branding.
                </TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clone event</DialogTitle>
            <DialogDescription>
              Copies settings, forms, submission types, and eligibility from{" "}
              {event.name}. Submissions are not copied. Reviewer pool copy is not
              included yet (TODO).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="clone-event-name">
                Name <span className="text-muted-foreground">*</span>
              </Label>
              <Input
                id="clone-event-name"
                className="h-10"
                value={cloneForm.name}
                onChange={(e) => handleCloneNameChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="clone-event-edition">Edition</Label>
              <Input
                id="clone-event-edition"
                className="h-10"
                value={cloneForm.edition}
                onChange={(e) =>
                  setCloneForm((prev) => ({ ...prev, edition: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="clone-event-slug">
                Slug <span className="text-muted-foreground">*</span>
              </Label>
              <Input
                id="clone-event-slug"
                className="h-10"
                value={cloneForm.slug}
                onChange={(e) => {
                  setCloneSlugTouched(true);
                  setCloneForm((prev) => ({ ...prev, slug: e.target.value }));
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={cloneLoading}
              onClick={() => setCloneOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10"
              disabled={cloneLoading}
              onClick={() => void submitClone()}
            >
              {cloneLoading ? "Cloning…" : "Clone event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend deadline</DialogTitle>
            <DialogDescription>
              Choose a submitter and a new deadline. Only users with the
              SUBMITTER role are listed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ext-submitter">Submitter</Label>
              <Select value={submitterUserId} onValueChange={setSubmitterUserId}>
                <SelectTrigger id="ext-submitter" className="h-10">
                  <SelectValue placeholder="Select submitter" />
                </SelectTrigger>
                <SelectContent>
                  {submitters.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No submitters yet
                    </SelectItem>
                  ) : (
                    submitters.map((role) => (
                      <SelectItem key={role.userId} value={role.userId}>
                        {role.user.fullName?.trim() || role.user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ext-until">Extends until</Label>
              <Input
                id="ext-until"
                className="h-10"
                type="datetime-local"
                value={extendsUntil}
                onChange={(e) => setExtendsUntil(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ext-reason">Reason (optional)</Label>
              <Textarea
                id="ext-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={extendLoading}
              onClick={() => setExtendOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10"
              disabled={extendLoading}
              onClick={() => void submitExtension()}
            >
              {extendLoading ? "Saving…" : "Add extension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
