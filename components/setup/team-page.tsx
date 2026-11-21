"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Trash2, UserPlus, UsersRound } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { toast } from "@/components/shared/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api/client";
import type { CategoryDto, EventRoleDto } from "@/lib/types/api";

type TeamRole = "EVENT_ADMIN" | "TRACK_CHAIR" | "FINANCE_OFFICER";

const ROLE_LABELS: Record<TeamRole, string> = {
  EVENT_ADMIN: "Event admin",
  TRACK_CHAIR: "Track chair",
  FINANCE_OFFICER: "Finance officer",
};

const ROLE_HELP: Record<TeamRole, string> = {
  EVENT_ADMIN: "Configures the event, sees author names and makes decisions.",
  TRACK_CHAIR: "Assigns reviewers, views scores and recommends decisions in their tracks.",
  FINANCE_OFFICER: "Verifies bank slips, issues receipts and sees payment reports.",
};

function isTeamRole(role: string): role is TeamRole {
  return role in ROLE_LABELS;
}

function personName(role: EventRoleDto) {
  return role.user.fullName?.trim() || role.user.email;
}

type InviteResult = { invited: boolean; role: EventRoleDto };

function TrackPicker({
  categories,
  selected,
  onChange,
}: {
  categories: CategoryDto[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">This event has no tracks yet. Add them under Tracks and chairs.</p>;
  }
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-base font-medium">Tracks</legend>
      {categories.map((category) => {
        const id = `team-track-${category.id}`;
        return (
          <div key={category.id} className="flex min-h-control items-center gap-3">
            <Checkbox
              id={id}
              checked={selected.includes(category.id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? [...selected, category.id]
                    : selected.filter((value) => value !== category.id),
                )
              }
            />
            <Label htmlFor={id} className="text-base font-normal">{category.name}</Label>
          </div>
        );
      })}
    </fieldset>
  );
}

/** Event staff: admins, track chairs and finance officers. Reviewers are managed under Reviews. */
export function TeamPage({ orgId, eventId }: { orgId: string; eventId: string }) {
  const base = `/api/v1/orgs/${orgId}/events/${eventId}`;

  const [roles, setRoles] = useState<EventRoleDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("TRACK_CHAIR");
  const [inviteTracks, setInviteTracks] = useState<string[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const [editing, setEditing] = useState<EventRoleDto | null>(null);
  const [editTracks, setEditTracks] = useState<string[]>([]);
  const [savingTracks, setSavingTracks] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<EventRoleDto | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchTeam = useCallback(
    () =>
      Promise.all([
        apiFetch<EventRoleDto[]>(`${base}/roles`),
        apiFetch<CategoryDto[]>(`${base}/categories`),
      ]),
    [base],
  );

  const applyTeam = useCallback(([rolesRes, categoriesRes]: Awaited<ReturnType<typeof fetchTeam>>) => {
    if (rolesRes.ok) {
      setRoles(rolesRes.data);
      setLoadError(null);
    } else {
      setLoadError(rolesRes.error.message || "The team couldn't be loaded.");
    }
    if (categoriesRes.ok) setCategories(categoriesRes.data);
    setLoading(false);
  }, []);

  const load = useCallback(async () => applyTeam(await fetchTeam()), [applyTeam, fetchTeam]);

  useEffect(() => {
    let active = true;
    void fetchTeam().then((results) => {
      if (active) applyTeam(results);
    });
    return () => {
      active = false;
    };
  }, [applyTeam, fetchTeam]);

  const team = useMemo(() => roles.filter((role) => isTeamRole(role.role)), [roles]);
  const trackName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  function openInvite() {
    setEmail("");
    setFullName("");
    setInviteRole("TRACK_CHAIR");
    setInviteTracks([]);
    setEmailError(null);
    setInviteOpen(true);
  }

  async function submitInvite() {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address, like name@hospital.lk.");
      return;
    }
    setEmailError(null);
    setInviting(true);
    try {
      const result = await apiFetch<InviteResult>(`${base}/roles/invite`, {
        method: "POST",
        body: {
          email: trimmed,
          ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
          role: inviteRole,
          ...(inviteRole === "TRACK_CHAIR" ? { categoryIds: inviteTracks } : {}),
        },
      });
      if (!result.ok) {
        toast.error("Couldn't send the invitation", { description: result.error.message });
        return;
      }
      if (result.data.invited) {
        toast.success("Invitation sent", `${trimmed} will get an email to set a password.`);
      } else {
        toast.success(`Added as ${ROLE_LABELS[inviteRole].toLowerCase()}`, "They already have an account, so no email was sent. Let them know.");
      }
      setInviteOpen(false);
      await load();
    } finally {
      setInviting(false);
    }
  }

  async function saveTracks() {
    if (!editing) return;
    setSavingTracks(true);
    try {
      const result = await apiFetch<EventRoleDto>(`${base}/roles/${editing.id}`, {
        method: "PATCH",
        body: { categoryIds: editTracks },
      });
      if (!result.ok) {
        toast.error("Couldn't save the tracks", { description: result.error.message });
        return;
      }
      toast.success("Tracks saved");
      setEditing(null);
      await load();
    } finally {
      setSavingTracks(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const result = await apiFetch(`${base}/roles/${removeTarget.id}`, { method: "DELETE" });
      if (!result.ok) {
        toast.error("Couldn't remove this role", { description: result.error.message });
        return;
      }
      toast.success("Role removed");
      setRemoveTarget(null);
      await load();
    } finally {
      setRemoving(false);
    }
  }

  const columns: DataTableColumn<EventRoleDto>[] = [
    {
      id: "person",
      header: "Person",
      mobile: "title",
      cell: (role) => (
        <span className="block min-w-0">
          <span className="block font-medium [overflow-wrap:anywhere]">{personName(role)}</span>
          {role.user.fullName ? (
            <span className="block text-sm font-normal text-muted-foreground [overflow-wrap:anywhere]">{role.user.email}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: (role) => <Badge variant="secondary">{ROLE_LABELS[role.role as TeamRole]}</Badge>,
    },
    {
      id: "tracks",
      header: "Tracks",
      cell: (role) => {
        if (role.role !== "TRACK_CHAIR") return <span className="text-muted-foreground">—</span>;
        const names = role.categoryIds.map((id) => trackName.get(id)).filter(Boolean);
        return names.length ? names.join(", ") : <span className="text-warning-foreground">No tracks yet</span>;
      },
    },
  ];

  const inviteButton = (
    <Button type="button" onClick={openInvite}>
      <UserPlus data-icon="inline-start" />
      Invite person
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Team"
        description="Who helps run this event. Reviewers are invited and managed under Reviews."
        actions={inviteButton}
      />

      <DataTable
        caption="Event team"
        columns={columns}
        rows={team}
        getRowId={(role) => role.id}
        loading={loading}
        error={loadError}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
        empty={{
          icon: UsersRound,
          title: "No team members yet",
          description: "Invite an event admin, track chair or finance officer to help run this event.",
          action: inviteButton,
        }}
        rowActions={(role) => (
          <>
            {role.role === "TRACK_CHAIR" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit tracks for ${personName(role)}`}
                onClick={() => {
                  setEditTracks(role.categoryIds);
                  setEditing(role);
                }}
              >
                <Pencil />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${personName(role)} as ${ROLE_LABELS[role.role as TeamRole]}`}
              onClick={() => setRemoveTarget(role)}
            >
              <Trash2 />
            </Button>
          </>
        )}
      />

      <SidePanel
        open={inviteOpen}
        onOpenChange={(open) => (inviting ? null : setInviteOpen(open))}
        title="Invite person"
        description="New people get an email to set a password. Existing accounts get the role straight away."
        footer={
          <>
            <Button variant="outline" disabled={inviting} onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button disabled={inviting} onClick={() => void submitInvite()}>
              {inviting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {inviting ? "Sending…" : "Send invitation"}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <FormField label="Email" required error={emailError}>
            <Input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Full name" optional>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </FormField>
          <FormField label="Role" required help={ROLE_HELP[inviteRole]}>
            {(p) => (
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as TeamRole)}>
                <SelectTrigger {...p} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as TeamRole[]).map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          {inviteRole === "TRACK_CHAIR" ? (
            <TrackPicker categories={categories} selected={inviteTracks} onChange={setInviteTracks} />
          ) : null}
        </div>
      </SidePanel>

      <SidePanel
        open={Boolean(editing)}
        onOpenChange={(open) => (!open && !savingTracks ? setEditing(null) : null)}
        title="Edit tracks"
        description={editing ? personName(editing) : undefined}
        footer={
          <>
            <Button variant="outline" disabled={savingTracks} onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={savingTracks} onClick={() => void saveTracks()}>
              {savingTracks ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {savingTracks ? "Saving…" : "Save tracks"}
            </Button>
          </>
        }
      >
        <TrackPicker categories={categories} selected={editTracks} onChange={setEditTracks} />
      </SidePanel>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove this role?"
        description={
          removeTarget
            ? `${personName(removeTarget)} will no longer be ${ROLE_LABELS[removeTarget.role as TeamRole].toLowerCase()} for this event. Their account and any other roles stay.`
            : "This role will be removed."
        }
        confirmLabel="Remove role"
        destructive
        loading={removing}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
