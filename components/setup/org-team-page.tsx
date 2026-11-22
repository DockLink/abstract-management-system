"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { toast } from "@/components/shared/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

type OrgMemberDto = {
  id: string;
  userId: string;
  role: "ORG_ADMIN" | "MEMBER";
  user: { id: string; email: string; fullName: string | null };
};

function personName(member: OrgMemberDto) {
  return member.user.fullName?.trim() || member.user.email;
}

export function OrgTeamPage({ orgId, orgName }: { orgId: string; orgName: string }) {
  const base = `/api/v1/orgs/${orgId}/members`;

  const [members, setMembers] = useState<OrgMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<OrgMemberDto | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchMembers = useCallback(() => apiFetch<OrgMemberDto[]>(base), [base]);

  const applyMembers = useCallback((result: Awaited<ReturnType<typeof fetchMembers>>) => {
    if (result.ok) {
      setMembers(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.error.message || "The organisation team couldn't be loaded.");
    }
    setLoading(false);
  }, []);

  const load = useCallback(async () => applyMembers(await fetchMembers()), [applyMembers, fetchMembers]);

  useEffect(() => {
    let active = true;
    void fetchMembers().then((result) => {
      if (active) applyMembers(result);
    });
    return () => {
      active = false;
    };
  }, [applyMembers, fetchMembers]);

  function openInvite() {
    setEmail("");
    setFullName("");
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
      const result = await apiFetch<{ invited: boolean }>(`${base}/invite`, {
        method: "POST",
        body: {
          email: trimmed,
          ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
          role: "ORG_ADMIN",
        },
      });
      if (!result.ok) {
        toast.error("Couldn't send the invitation", { description: result.error.message });
        return;
      }
      if (result.data.invited) {
        toast.success("Invitation sent", `${trimmed} will get an email to set a password.`);
      } else {
        toast.success("Added as org admin", "They already have an account, so no email was sent. Let them know.");
      }
      setInviteOpen(false);
      await load();
    } finally {
      setInviting(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const result = await apiFetch(`${base}/${removeTarget.id}`, { method: "DELETE" });
      if (!result.ok) {
        toast.error("Couldn't remove this person", { description: result.error.message });
        return;
      }
      toast.success("Removed from the organisation");
      setRemoveTarget(null);
      await load();
    } finally {
      setRemoving(false);
    }
  }

  const columns: DataTableColumn<OrgMemberDto>[] = [
    {
      id: "person",
      header: "Person",
      mobile: "title",
      cell: (member) => (
        <span className="block min-w-0">
          <span className="block font-medium [overflow-wrap:anywhere]">{personName(member)}</span>
          {member.user.fullName ? (
            <span className="block text-sm font-normal text-muted-foreground [overflow-wrap:anywhere]">{member.user.email}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: (member) => <Badge variant="secondary">{member.role === "ORG_ADMIN" ? "Org admin" : "Member"}</Badge>,
    },
  ];

  const inviteButton = (
    <Button type="button" onClick={openInvite}>
      <UserPlus data-icon="inline-start" />
      Invite org admin
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Organisation team"
        description={`Org admins can create events and manage every event in ${orgName}.`}
        actions={inviteButton}
      />

      <DataTable
        caption="Organisation team"
        columns={columns}
        rows={members}
        getRowId={(member) => member.id}
        loading={loading}
        error={loadError}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
        empty={{
          icon: ShieldCheck,
          title: "No org admins yet",
          description: "Invite someone from the college to create and manage its events.",
          action: inviteButton,
        }}
        rowActions={(member) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${personName(member)}`}
            onClick={() => setRemoveTarget(member)}
          >
            <Trash2 />
          </Button>
        )}
      />

      <SidePanel
        open={inviteOpen}
        onOpenChange={(open) => (inviting ? null : setInviteOpen(open))}
        title="Invite org admin"
        description="New people get an email to set a password. Existing accounts get access straight away."
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
        </div>
      </SidePanel>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove from the organisation?"
        description={
          removeTarget
            ? `${personName(removeTarget)} will lose organisation access. Their account and any event roles stay.`
            : "This person will be removed."
        }
        confirmLabel="Remove"
        destructive
        loading={removing}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
