"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EventDate } from "@/components/shared/event-date";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  async function submitNewEvent() {
    const name = newForm.name.trim();
    const slug = newForm.slug.trim();
    if (!name) {
      toast.error("Event name is required");
      return;
    }
    if (!slug || slug.length < 2) {
      toast.error("Slug must be at least 2 characters (kebab-case)");
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
        toast.error(result.error.message || "Could not create event");
        return;
      }

      toast.success("Event created");
      setNewOpen(false);
      resetNewForm();
      router.refresh();
    } finally {
      setNewLoading(false);
    }
  }

  async function submitCloneEvent() {
    if (!cloneSource) return;
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
        toast.error(result.error.message || "Could not clone event");
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
        toast.error(result.error.message || "Could not archive event");
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

  return (
    <div className="text-sm">
      <PageHeader
        title="Events"
        description={`Create, clone, and manage events for ${orgName}.`}
        actions={
          <Button type="button" className="h-10" onClick={openNewDialog}>
            New event
          </Button>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No events yet"
          description="Create your first event or clone a previous edition to get started quickly."
          actionLabel="New event"
          onAction={openNewDialog}
        />
      ) : (
        <Card className="border border-border bg-white py-0 ring-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Edition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submission window</TableHead>
                  <TableHead className="w-[88px] text-right" />
                  <TableHead className="w-[52px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const status = getEventLifecycleStatus(event.keyDates);
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">
                        {event.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.edition ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell>
                        <SubmissionWindow keyDates={event.keyDates} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          className="h-9"
                          asChild
                        >
                          <Link href={eventHref(event.slug)}>Open</Link>
                        </Button>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                aria-label={`Actions for ${event.name}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={eventHref(event.slug)}>Open</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => openCloneDialog(event)}
                              >
                                <CloneIcon />
                                Clone
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => openArchiveDialog(event)}
                              >
                                <ArchiveIcon />
                                Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>
              Add name, edition, and URL slug. You can configure dates and setup
              after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-event-name">
                Name <span className="text-muted-foreground">*</span>
              </Label>
              <Input
                id="new-event-name"
                className="h-10"
                value={newForm.name}
                onChange={(e) => handleNewNameChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-event-edition">Edition</Label>
              <Input
                id="new-event-edition"
                className="h-10"
                placeholder='e.g. "54th Annual Academic Sessions"'
                value={newForm.edition}
                onChange={(e) =>
                  setNewForm((prev) => ({ ...prev, edition: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-event-slug">
                Slug <span className="text-muted-foreground">*</span>
              </Label>
              <Input
                id="new-event-slug"
                className="h-10"
                value={newForm.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setNewForm((prev) => ({ ...prev, slug: e.target.value }));
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-event-venue">Venue</Label>
              <Input
                id="new-event-venue"
                className="h-10"
                value={newForm.venue}
                onChange={(e) =>
                  setNewForm((prev) => ({ ...prev, venue: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={newLoading}
              onClick={() => setNewOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10"
              disabled={newLoading}
              onClick={() => void submitNewEvent()}
            >
              {newLoading ? "Creating…" : "Create event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clone event</DialogTitle>
            <DialogDescription>
              Copies settings, forms, submission types, and eligibility from{" "}
              {cloneSource?.name ?? "this event"}. Submissions are not copied.
              Reviewer pool copy is not included yet (TODO).
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
              onClick={() => void submitCloneEvent()}
            >
              {cloneLoading ? "Cloning…" : "Clone event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive event?"
        description={
          archiveTarget
            ? `“${archiveTarget.name}” will be removed from this list. You can’t undo this from the UI.`
            : "This event will be archived."
        }
        confirmLabel="Archive"
        destructive
        loading={archiveLoading}
        onConfirm={confirmArchive}
      />
    </div>
  );
}
