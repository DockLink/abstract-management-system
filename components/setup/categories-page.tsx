"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

    if (catRes.ok) setCategories(catRes.data);
    else toast.error(catRes.error.message || "Could not load categories");

    if (rolesRes.ok) setRoles(rolesRes.data);
    else toast.error(rolesRes.error.message || "Could not load roles");

    setLoading(false);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setChairUserId("none");
    setSheetOpen(true);
  }

  function openEdit(category: CategoryDto) {
    setEditing(category);
    setName(category.name);
    setChairUserId(category.chairUserId ?? "none");
    setSheetOpen(true);
  }

  async function saveCategory() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Category name is required");
      return;
    }

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
          toast.error(result.error.message || "Could not update category");
          return;
        }
        toast.success("Category updated");
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
          toast.error(result.error.message || "Could not create category");
          return;
        }
        toast.success("Category created");
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
        toast.error(result.error.message || "Could not delete category");
        return;
      }
      toast.success("Category deleted");
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
        toast.error("Could not reorder categories");
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

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Define submission tracks and assign track chairs."
        actions={
          <Button type="button" className="h-10" onClick={openCreate}>
            Add category
          </Button>
        }
      />

      {loading ? (
        <Card className="border border-border bg-white py-8">
          <CardContent className="text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={CategoriesIcon}
          title="No categories yet"
          description="Add categories so submitters can choose a track for each abstract."
          actionLabel="Add category"
          onAction={openCreate}
        />
      ) : (
        <Card className="border border-border bg-white py-0 ring-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Chair</TableHead>
                  <TableHead className="text-right">Submissions</TableHead>
                  <TableHead className="w-[120px] text-right">Order</TableHead>
                  <TableHead className="w-[52px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((category, index) => {
                  const chair = category.chairUserId
                    ? chairByUserId.get(category.chairUserId)
                    : undefined;
                  const submissionCount = 0;
                  // TODO: wire to GET /api/... submissions by category when Module 2 lands

                  return (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">
                        {category.name}
                      </TableCell>
                      <TableCell>
                        {chair ? (
                          <span className="inline-flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarFallback className="text-[10px]">
                                {initials(chair)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{displayName(chair)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {submissionCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9"
                            disabled={
                              index === 0 || reorderLoadingId === category.id
                            }
                            aria-label="Move up"
                            onClick={() => void moveCategory(category, "up")}
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9"
                            disabled={
                              index === sorted.length - 1 ||
                              reorderLoadingId === category.id
                            }
                            aria-label="Move down"
                            onClick={() => void moveCategory(category, "down")}
                          >
                            <ArrowDown className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={`Actions for ${category.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEdit(category)}>
                              <Pencil />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleteTarget(category)}
                            >
                              <Trash2 />
                              Delete
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing ? "Edit category" : "Add category"}
            </SheetTitle>
            <SheetDescription>
              Name the track and optionally assign a chair from event admins or
              track chairs.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-name">
                Name <span className="text-muted-foreground">*</span>
              </Label>
              <Input
                id="category-name"
                className="h-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-chair">Chair</Label>
              <Select value={chairUserId} onValueChange={setChairUserId}>
                <SelectTrigger id="category-chair" className="h-10">
                  <SelectValue placeholder="Select chair" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No chair</SelectItem>
                  {chairRoles.map((role) => (
                    <SelectItem key={role.userId} value={role.userId}>
                      {displayName(role)} ({role.role.replace("_", " ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={saveLoading}
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10"
              disabled={saveLoading}
              onClick={() => void saveCategory()}
            >
              {saveLoading ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete category?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed. Existing submissions are not handled until Module 2.`
            : "This category will be deleted."
        }
        confirmLabel="Delete"
        destructive
        loading={deleteLoading}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
