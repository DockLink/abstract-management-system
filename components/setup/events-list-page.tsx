"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EventDate } from "@/components/shared/event-date";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { StepIndicator } from "@/components/shared/step-indicator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { EventIcons } from "@/lib/events/icons";
import { getEventLifecycleStatus } from "@/lib/events/status";
import type { EventDto, KeyDates } from "@/lib/types/api";

function toKebabSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function SubmissionWindow({ keyDates }: { keyDates: KeyDates }) {
  const { submissionOpenAt, submissionCloseAt } = keyDates;
  if (!submissionOpenAt && !submissionCloseAt) {
    return <span className="text-muted-foreground">Not set</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <EventDate value={submissionOpenAt} includeTime={false} />
      <span className="text-muted-foreground">–</span>
      <EventDate value={submissionCloseAt} includeTime={false} />
    </span>
  );
}

type NewEventForm = {
  name: string;
  edition: string;
  slug: string;
  venue: string;
};

type CloneEventForm = {
  name: string;
  slug: string;
  edition: string;
};

export function EventsListPage({
  orgSlug,
  orgId,
  orgName,
  events,
}: {
  orgSlug: string;
  orgId: string;
  orgName: string;
  events: EventDto[];
}) {
  const router = useRouter();
  const CloneIcon = EventIcons.clone;
  const ArchiveIcon = EventIcons.archive;

  const [newOpen, setNewOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<EventDto | null>(null);
  const [cloneSource, setCloneSource] = useState<EventDto | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [cloneSlugTouched, setCloneSlugTouched] = useState(false);
  const [newLoading, setNewLoading] = useState(false);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const [newStep, setNewStep] = useState(0);
  const [newErrors, setNewErrors] = useState<{ name?: string; slug?: string }>({});
  const [cloneErrors, setCloneErrors] = useState<{ name?: string; slug?: string }>({});

  const [newForm, setNewForm] = useState<NewEventForm>({
    name: "",
    edition: "",
    slug: "",
    venue: "",
  });

  const [cloneForm, setCloneForm] = useState<CloneEventForm>({
    name: "",
    slug: "",
    edition: "",
  });

  const resetNewForm = useCallback(() => {
    setNewForm({ name: "", edition: "", slug: "", venue: "" });
    setSlugTouched(false);
    setNewStep(0);
    setNewErrors({});
  }, []);

  const openNewDialog = useCallback(() => {
    resetNewForm();
    setNewOpen(true);
  }, [resetNewForm]);

  const openCloneDialog = useCallback((event: EventDto) => {
    const baseName = `${event.name} (copy)`;
    setCloneSource(event);
    setCloneForm({
      name: baseName,
      slug: toKebabSlug(baseName),
      edition: event.edition ?? "",
    });
    setCloneSlugTouched(false);
    setCloneErrors({});
    setCloneOpen(true);
  }, []);

  const openArchiveDialog = useCallback((event: EventDto) => {
    setArchiveTarget(event);
    setArchiveOpen(true);
  }, []);

  const eventHref = useMemo(
    () => (slug: string) => `/org/${orgSlug}/events/${slug}/dashboard`,
    [orgSlug],
  );

  function handleNewNameChange(name: string) {
    setNewForm((prev) => ({
      ...prev,
      name,
      slug: slugTouched ? prev.slug : toKebabSlug(name),
    }));
  }

  function handleCloneNameChange(name: string) {
    setCloneForm((prev) => ({
      ...prev,
      name,
      slug: cloneSlugTouched ? prev.slug : toKebabSlug(name),
    }));
  }

  function validateNameSlug(form: { name: string; slug: string }) {
    const errors: { name?: string; slug?: string } = {};
    if (!form.name.trim()) errors.name = "Enter the event name.";
    const slug = form.slug.trim();
    if (!slug || slug.length < 2) {
      errors.slug = "Use at least 2 characters: lowercase letters, numbers and hyphens.";
    }
    return errors;
  }

  function goToNewStep2() {
    const errors = validateNameSlug(newForm);
    setNewErrors(errors);
    if (!errors.name && !errors.slug) setNewStep(1);
  }

  async function submitNewEvent() {
    const name = newForm.name.trim();
    const slug = newForm.slug.trim();
    const errors = validateNameSlug(newForm);
    setNewErrors(errors);
    if (errors.name || errors.slug) {
      setNewStep(0);
      return;
    }

    setNewLoading(true);
    try {
      const edition = newForm.edition.trim();
      const venue = newForm.venue.trim();
      const result = await apiFetch<EventDto>(`/api/v1/orgs/${orgId}/events`, {
        method: "POST",
        body: {
          name,
          slug,
          edition: edition || null,
          venue: venue || null,
        },
      });

      if (!result.ok) {
        toast.error("Couldn't create the event", { description: result.error.message });
        return;
      }

      toast.success("Event created", "Work through the setup checklist next.");
      setNewOpen(false);
      resetNewForm();
      router.push(`/org/${orgSlug}/events/${result.data.slug}/setup`);
      router.refresh();
    } finally {
      setNewLoading(false);
    }
  }

  async function submitCloneEvent() {
    if (!cloneSource) return;
    const name = cloneForm.name.trim();
    const slug = cloneForm.slug.trim();
    const errors = validateNameSlug(cloneForm);
    setCloneErrors(errors);
    if (errors.name || errors.slug) return;

    setCloneLoading(true);
    try {
      const edition = cloneForm.edition.trim();
      const result = await apiFetch<EventDto>(
        `/api/v1/orgs/${orgId}/events/${cloneSource.id}/clone`,
        {
          method: "POST",
          body: {
            name,
            slug,
            edition: edition || null,
          },
        },
      );

      if (!result.ok) {
        toast.error("Couldn't clone the event", { description: result.error.message });
        return;
      }

      toast.success("Event cloned");
      setCloneOpen(false);
      setCloneSource(null);
      router.refresh();
    } finally {
      setCloneLoading(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      const result = await apiFetch<{ id: string; deleted: boolean }>(
        `/api/v1/orgs/${orgId}/events/${archiveTarget.id}`,
        { method: "DELETE" },
      );

      if (!result.ok) {
        toast.error("Couldn't archive the event", { description: result.error.message });
        return;
      }

      toast.success("Event archived");
      setArchiveOpen(false);
      setArchiveTarget(null);
      router.refresh();
    } finally {
      setArchiveLoading(false);
    }
  }

  const columns: DataTableColumn<EventDto>[] = [
    {
      id: "name",
      header: "Event",
      mobile: "title",
      className: "min-w-64",
      cell: (event) => (
        <Link href={eventHref(event.slug)} className="block hover:underline">
          <span className="block font-semibold text-foreground">{event.name}</span>
          {event.edition ? (
            <span className="block text-sm font-normal text-muted-foreground">{event.edition}</span>
          ) : null}
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      mobile: "meta",
      cell: (event) => <StatusBadge status={getEventLifecycleStatus(event.keyDates)} size="sm" />,
    },
    {
      id: "window",
      header: "Submission window",
      cell: (event) => <SubmissionWindow keyDates={event.keyDates} />,
    },
  ];

  const slugPreview = (slug: string) => `/${orgSlug}/${slug || "your-event"}`;

  return (
    <div>
      <PageHeader
        title="Events"
        description={`Create, clone and manage events for ${orgName}.`}
        actions={
          <Button type="button" onClick={openNewDialog}>
            <Plus data-icon="inline-start" />
            New event
          </Button>
        }
      />

      <DataTable
        caption={`Events for ${orgName}`}
        columns={columns}
        rows={events}
        getRowId={(e) => e.id}
        empty={{
          icon: Calendar,
          title: "No events yet",
          description: "Create your first event, or clone last year's to start from its settings.",
          action: (
            <Button onClick={openNewDialog}>
              <Plus data-icon="inline-start" />
              New event
            </Button>
          ),
        }}
        rowActions={(event) => (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={eventHref(event.slug)}>
                Open<span className="sr-only"> {event.name}</span>
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`More actions for ${event.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/org/${orgSlug}/events/${event.slug}/setup`}>Setup checklist</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openCloneDialog(event)}>
                  <CloneIcon />
                  Clone for next year…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => openArchiveDialog(event)}>
                  <ArchiveIcon />
                  Archive…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      />

      {/* New event — two short steps; everything else lives on the setup checklist */}
      <SidePanel
        open={newOpen}
        onOpenChange={(o) => (newLoading ? null : setNewOpen(o))}
        title="New event"
        description="Two quick steps. Dates, tracks and forms come next, on the setup checklist."
        footer={
          newStep === 0 ? (
            <>
              <Button variant="outline" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button onClick={goToNewStep2}>Continue</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={newLoading} onClick={() => setNewStep(0)}>
                Back
              </Button>
              <Button disabled={newLoading} onClick={() => void submitNewEvent()}>
                {newLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                {newLoading ? "Creating…" : "Create event"}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-6">
          <StepIndicator
            steps={[{ label: "Name and web address" }, { label: "Edition and venue" }]}
            current={newStep}
            onStepClick={(i) => (i === 0 ? setNewStep(0) : goToNewStep2())}
          />
          {newStep === 0 ? (
            <div className="grid gap-5">
              <FormField label="Event name" required error={newErrors.name} help='For example "Annual Academic Sessions 2027".'>
                <Input
                  value={newForm.name}
                  onChange={(e) => handleNewNameChange(e.target.value)}
                  autoFocus
                />
              </FormField>
              <FormField
                label="Web address"
                required
                error={newErrors.slug}
                help={
                  <>
                    The public page will be at <span className="font-mono text-foreground">{slugPreview(newForm.slug)}</span>.
                    Filled in from the name — change it if you like.
                  </>
                }
              >
                <Input
                  value={newForm.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setNewForm((prev) => ({ ...prev, slug: e.target.value }));
                  }}
                  className="font-mono"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </FormField>
            </div>
          ) : (
            <div className="grid gap-5">
              <FormField label="Edition" optional help='For example "55th Annual Academic Sessions".'>
                <Input
                  value={newForm.edition}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, edition: e.target.value }))}
                  autoFocus
                />
              </FormField>
              <FormField label="Venue" optional help="You can change this later in Event details.">
                <Input
                  value={newForm.venue}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, venue: e.target.value }))}
                />
              </FormField>
              <div className="rounded-lg border border-border bg-surface p-4 text-base">
                <p className="font-semibold">{newForm.name.trim()}</p>
                <p className="font-mono text-sm text-muted-foreground">{slugPreview(newForm.slug.trim())}</p>
              </div>
            </div>
          )}
        </div>
      </SidePanel>

      {/* Clone (EVT-09) */}
      <SidePanel
        open={cloneOpen}
        onOpenChange={(o) => (cloneLoading ? null : setCloneOpen(o))}
        title="Clone event"
        description={
          <>
            Copies settings, forms, submission types and eligibility from{" "}
            <strong className="font-semibold text-foreground">{cloneSource?.name ?? "this event"}</strong>.
            Submissions are not copied, and the reviewer pool isn&apos;t copied yet.
          </>
        }
        footer={
          <>
            <Button variant="outline" disabled={cloneLoading} onClick={() => setCloneOpen(false)}>
              Cancel
            </Button>
            <Button disabled={cloneLoading} onClick={() => void submitCloneEvent()}>
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
            <Input
              value={cloneForm.edition}
              onChange={(e) => setCloneForm((prev) => ({ ...prev, edition: e.target.value }))}
            />
          </FormField>
          <FormField
            label="Web address"
            required
            error={cloneErrors.slug}
            help={<>Public page: <span className="font-mono text-foreground">{slugPreview(cloneForm.slug)}</span></>}
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

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this event?"
        description={
          archiveTarget
            ? `“${archiveTarget.name}” will disappear from this list and its public page will stop working. You can't undo this here.`
            : "This event will be archived."
        }
        confirmLabel="Archive event"
        destructive
        loading={archiveLoading}
        onConfirm={confirmArchive}
      />
    </div>
  );
}
