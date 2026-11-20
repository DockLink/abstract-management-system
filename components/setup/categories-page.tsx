"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { toast } from "@/components/shared/toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api/client";
import { EventIcons } from "@/lib/events/icons";
import type { CategoryDto, EventRoleDto } from "@/lib/types/api";

const CHAIR_ROLES = new Set(["EVENT_ADMIN", "TRACK_CHAIR"]);

function displayName(role: EventRoleDto): string {
  return role.user.fullName?.trim() || role.user.email;
}

function initials(role: EventRoleDto): string {
  const name = displayName(role);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function CategoriesPage({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const CategoriesIcon = EventIcons.categories;
  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [roles, setRoles] = useState<EventRoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [name, setName] = useState("");
  const [chairUserId, setChairUserId] = useState<string>("none");
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryDto | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [reorderLoadingId, setReorderLoadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const chairRoles = useMemo(
    () => roles.filter((r) => CHAIR_ROLES.has(r.role)),
    [roles],
  );

  const chairByUserId = useMemo(() => {
    const map = new Map<string, EventRoleDto>();
    for (const role of chairRoles) {
      map.set(role.userId, role);
    }
    return map;
  }, [chairRoles]);

  const load = useCallback(async () => {
    const [catRes, rolesRes] = await Promise.all([
      apiFetch<CategoryDto[]>(`${base}/categories`),
      apiFetch<EventRoleDto[]>(`${base}/roles`),
    ]);

    if (catRes.ok) {
      setCategories(catRes.data);
      setLoadError(null);
    } else {
      setLoadError(catRes.error.message || "The categories couldn't be loaded.");
    }

    if (rolesRes.ok) setRoles(rolesRes.data);
    else toast.error("Couldn't load the list of possible chairs", { description: rolesRes.error.message });

    setLoading(false);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setChairUserId("none");
    setNameError(null);
    setSheetOpen(true);
  }

  function openEdit(category: CategoryDto) {
    setEditing(category);
    setName(category.name);
    setChairUserId(category.chairUserId ?? "none");
    setNameError(null);
    setSheetOpen(true);
  }

  async function saveCategory() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter a name for this track.");
      return;
    }
    setNameError(null);

    const chair =
      chairUserId === "none" ? null : chairUserId;

    setSaveLoading(true);
    try {
      if (editing) {
        const result = await apiFetch<CategoryDto>(
          `${base}/categories/${editing.id}`,
          {
            method: "PATCH",
            body: { name: trimmed, chairUserId: chair },
          },
        );
        if (!result.ok) {
          toast.error("Couldn't save the track", { description: result.error.message });
          return;
        }
        toast.success("Track saved");
      } else {
        const maxOrder = categories.reduce(
          (max, c) => Math.max(max, c.sortOrder),
          -1,
        );
        const result = await apiFetch<CategoryDto>(`${base}/categories`, {
          method: "POST",
          body: {
            name: trimmed,
            chairUserId: chair,
            sortOrder: maxOrder + 1,
          },
        });
        if (!result.ok) {
          toast.error("Couldn't add the track", { description: result.error.message });
          return;
        }
        toast.success("Track added");
      }
      setSheetOpen(false);
      await load();
    } finally {
      setSaveLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const result = await apiFetch<{ id: string; deleted: boolean }>(
        `${base}/categories/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (!result.ok) {
        toast.error("Couldn't delete the track", { description: result.error.message });
        return;
      }
      toast.success("Track deleted");
      setDeleteTarget(null);
      await load();
    } finally {
      setDeleteLoading(false);
    }
  }

  async function moveCategory(category: CategoryDto, direction: "up" | "down") {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((c) => c.id === category.id);
    if (index < 0) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const other = sorted[swapIndex]!;
    setReorderLoadingId(category.id);
    try {
      const [a, b] = await Promise.all([
        apiFetch<CategoryDto>(`${base}/categories/${category.id}`, {
          method: "PATCH",
          body: { sortOrder: other.sortOrder },
        }),
        apiFetch<CategoryDto>(`${base}/categories/${other.id}`, {
          method: "PATCH",
          body: { sortOrder: category.sortOrder },
        }),
      ]);
      if (!a.ok || !b.ok) {
        toast.error("Couldn't change the order", { description: "Refresh the page and try again." });
        return;
      }
      await load();
    } finally {
      setReorderLoadingId(null);
    }
  }

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const columns: DataTableColumn<CategoryDto>[] = [
    {
      id: "order",
      header: "#",
      mobile: "meta",
      className: "w-12 tabular-nums text-muted-foreground",
      cell: (c) => <span className="text-sm text-muted-foreground tabular-nums">Track {sorted.indexOf(c) + 1}</span>,
    },
    { id: "name", header: "Track", mobile: "title", cell: (c) => <span className="font-medium">{c.name}</span> },
    {
      id: "chair",
      header: "Track chair",
      cell: (c) => {
        const chair = c.chairUserId ? chairByUserId.get(c.chairUserId) : undefined;
        return chair ? (
          <span className="inline-flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary-tint text-xs text-brand-ink">{initials(chair)}</AvatarFallback>
            </Avatar>
            <span>{displayName(chair)}</span>
          </span>
        ) : (
          <span className="text-warning-foreground">No chair yet</span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tracks and chairs"
        description="The categories authors choose from, each with a track chair who assigns reviewers."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            Add track
          </Button>
        }
      />

      <DataTable
        caption="Tracks"
        columns={columns}
        rows={sorted}
        getRowId={(c) => c.id}
        loading={loading}
        error={loadError}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
        empty={{
          icon: CategoriesIcon,
          title: "No tracks yet",
          description: "Add tracks such as Trauma, Spine or Paediatric Orthopaedics so authors can choose where their abstract fits.",
          action: (
            <Button onClick={openCreate}>
              <Plus data-icon="inline-start" />
              Add track
            </Button>
          ),
        }}
        rowActions={(category) => {
          const index = sorted.indexOf(category);
          const busy = reorderLoadingId === category.id;
          return (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === 0 || busy}
                aria-label={`Move ${category.name} up`}
                onClick={() => void moveCategory(category, "up")}
              >
                {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === sorted.length - 1 || busy}
                aria-label={`Move ${category.name} down`}
                onClick={() => void moveCategory(category, "down")}
              >
                <ArrowDown />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`More actions for ${category.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => openEdit(category)}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(category)}>
                    <Trash2 />
                    Delete…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          );
        }}
      />

      <SidePanel
        open={sheetOpen}
        onOpenChange={(o) => (saveLoading ? null : setSheetOpen(o))}
        title={editing ? "Edit track" : "Add track"}
        description="Name the track and choose its chair. Chairs come from the event's admins and track chairs."
        footer={
          <>
            <Button variant="outline" disabled={saveLoading} onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saveLoading} onClick={() => void saveCategory()}>
              {saveLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {saveLoading ? "Saving…" : editing ? "Save track" : "Add track"}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <FormField label="Track name" required error={nameError} help="e.g. Trauma & Emergency Orthopaedics">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </FormField>
          <FormField
            label="Track chair"
            optional
            help={
              chairRoles.length === 0
                ? "No one can be chosen yet. Invite a track chair from Members first."
                : "Chairs assign reviewers and recommend decisions for this track."
            }
          >
            {(p) => (
              <Select value={chairUserId} onValueChange={setChairUserId}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue placeholder="Choose a chair" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No chair yet</SelectItem>
                  {chairRoles.map((role) => (
                    <SelectItem key={role.userId} value={role.userId}>
                      {displayName(role)} · {role.role === "EVENT_ADMIN" ? "Event admin" : "Track chair"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        </div>
      </SidePanel>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this track?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will no longer be offered to authors, and abstracts already in it will be left without a track. You can't undo this.`
            : "This track will be deleted."
        }
        confirmLabel="Delete track"
        destructive
        loading={deleteLoading}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
