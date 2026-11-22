"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, type ApiResult } from "@/lib/api/client";

type OrgDto = { id: string; name: string; slug: string; address: string | null };
type PlatformAdminDto = { id: string; email: string | null; fullName: string | null };

const fetchOrgs = () => apiFetch<OrgDto[]>("/api/v1/orgs");
const fetchAdmins = () => apiFetch<PlatformAdminDto[]>("/api/v1/auth/platform-admins");

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function PlatformPage({ currentUserId }: { currentUserId: string }) {
  const [orgs, setOrgs] = useState<OrgDto[]>([]);
  const [admins, setAdmins] = useState<PlatformAdminDto[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [adminsError, setAdminsError] = useState<string | null>(null);

  const [orgOpen, setOrgOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [orgAddress, setOrgAddress] = useState("");
  const [orgErrors, setOrgErrors] = useState<{ name?: string; slug?: string }>({});
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmailError, setAdminEmailError] = useState<string | null>(null);
  const [grantingAdmin, setGrantingAdmin] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<PlatformAdminDto | null>(null);
  const [revoking, setRevoking] = useState(false);

  const applyOrgs = useCallback((result: ApiResult<OrgDto[]>) => {
    if (result.ok) {
      setOrgs(result.data);
      setOrgsError(null);
    } else {
      setOrgsError(result.error.message || "Organisations couldn't be loaded.");
    }
    setOrgsLoading(false);
  }, []);

  const applyAdmins = useCallback((result: ApiResult<PlatformAdminDto[]>) => {
    if (result.ok) {
      setAdmins(result.data);
      setAdminsError(null);
    } else {
      setAdminsError(result.error.message || "Platform admins couldn't be loaded.");
    }
    setAdminsLoading(false);
  }, []);

  const loadOrgs = useCallback(async () => applyOrgs(await fetchOrgs()), [applyOrgs]);
  const loadAdmins = useCallback(async () => applyAdmins(await fetchAdmins()), [applyAdmins]);

  useEffect(() => {
    let active = true;
    void fetchOrgs().then((result) => {
      if (active) applyOrgs(result);
    });
    void fetchAdmins().then((result) => {
      if (active) applyAdmins(result);
    });
    return () => {
      active = false;
    };
  }, [applyOrgs, applyAdmins]);

  function openCreateOrg() {
    setOrgName("");
    setOrgSlug("");
    setSlugTouched(false);
    setOrgAddress("");
    setOrgErrors({});
    setOrgOpen(true);
  }

  async function createOrg() {
    const name = orgName.trim();
    const errors: { name?: string; slug?: string } = {};
    if (!name) errors.name = "Enter the organisation's name.";
    if (orgSlug.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(orgSlug)) {
      errors.slug = "Use lowercase letters, numbers and single hyphens, e.g. college-of-surgeons.";
    }
    setOrgErrors(errors);
    if (errors.name || errors.slug) return;

    setCreatingOrg(true);
    try {
      const result = await apiFetch<OrgDto>("/api/v1/orgs", {
        method: "POST",
        body: { name, slug: orgSlug, address: orgAddress.trim() || null },
      });
      if (!result.ok) {
        if (result.status === 409) setOrgErrors({ slug: "Another organisation already uses this web address." });
        else toast.error("Couldn't create the organisation", { description: result.error.message });
        return;
      }
      toast.success("Organisation created", "Open its Team page to invite an org admin.");
      setOrgOpen(false);
      await loadOrgs();
    } finally {
      setCreatingOrg(false);
    }
  }

  async function grantAdmin() {
    const email = adminEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAdminEmailError("Enter a valid email address.");
      return;
    }
    setAdminEmailError(null);
    setGrantingAdmin(true);
    try {
      const result = await apiFetch<{ invited: boolean }>("/api/v1/auth/platform-admins", {
        method: "POST",
        body: { email, ...(adminName.trim() ? { fullName: adminName.trim() } : {}) },
      });
      if (!result.ok) {
        toast.error("Couldn't add the platform admin", { description: result.error.message });
        return;
      }
      toast.success(
        result.data.invited ? "Invitation sent" : "Platform admin added",
        result.data.invited
          ? `${email} will get an email to set a password.`
          : "They already have an account, so no email was sent. Let them know.",
      );
      setAdminOpen(false);
      setAdminEmail("");
      setAdminName("");
      await loadAdmins();
    } finally {
      setGrantingAdmin(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const result = await apiFetch(`/api/v1/auth/platform-admins/${revokeTarget.id}`, { method: "DELETE" });
      if (!result.ok) {
        toast.error("Couldn't revoke access", { description: result.error.message });
        return;
      }
      toast.success("Platform admin access revoked");
      setRevokeTarget(null);
      await loadAdmins();
    } finally {
      setRevoking(false);
    }
  }

  const orgColumns: DataTableColumn<OrgDto>[] = [
    { id: "name", header: "Organisation", mobile: "title", cell: (o) => <span className="font-medium">{o.name}</span> },
    { id: "slug", header: "Web address", cell: (o) => <span className="[overflow-wrap:anywhere]">/{o.slug}</span> },
  ];
  const adminColumns: DataTableColumn<PlatformAdminDto>[] = [
    {
      id: "person",
      header: "Person",
      mobile: "title",
      cell: (a) => (
        <span className="block min-w-0">
          <span className="block font-medium [overflow-wrap:anywhere]">{a.fullName?.trim() || a.email}</span>
          {a.fullName ? <span className="block text-sm font-normal text-muted-foreground [overflow-wrap:anywhere]">{a.email}</span> : null}
        </span>
      ),
    },
  ];

  const newOrgButton = (
    <Button type="button" onClick={openCreateOrg}>
      <Plus data-icon="inline-start" />
      New organisation
    </Button>
  );

  return (
    <div className="space-y-12">
      <section>
        <PageHeader title="Organisations" description="Each college or university on the platform." actions={newOrgButton} />
        <DataTable
          caption="Organisations"
          columns={orgColumns}
          rows={orgs}
          getRowId={(o) => o.id}
          loading={orgsLoading}
          error={orgsError}
          onRetry={() => {
            setOrgsLoading(true);
            void loadOrgs();
          }}
          empty={{
            icon: Building2,
            title: "No organisations yet",
            description: "Create the first college, then invite its org admin.",
            action: newOrgButton,
          }}
          rowActions={(o) => (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/org/${o.slug}`}>Events<span className="sr-only"> for {o.name}</span></Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/org/${o.slug}/team`}>Team<span className="sr-only"> for {o.name}</span></Link>
              </Button>
            </>
          )}
        />
      </section>

      <section>
        <PageHeader
          title="Platform admins"
          description="Full access to every organisation. Keep this list short."
          actions={
            <Button type="button" variant="outline" onClick={() => setAdminOpen(true)}>
              <UserPlus data-icon="inline-start" />
              Add platform admin
            </Button>
          }
        />
        <DataTable
          caption="Platform admins"
          columns={adminColumns}
          rows={admins}
          getRowId={(a) => a.id}
          loading={adminsLoading}
          error={adminsError}
          onRetry={() => {
            setAdminsLoading(true);
            void loadAdmins();
          }}
          empty={{ icon: ShieldCheck, title: "No platform admins found" }}
          rowActions={(a) =>
            a.id === currentUserId ? (
              <span className="text-sm text-muted-foreground">You</span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Revoke platform admin for ${a.fullName || a.email}`}
                onClick={() => setRevokeTarget(a)}
              >
                <Trash2 />
              </Button>
            )
          }
        />
      </section>

      <SidePanel
        open={orgOpen}
        onOpenChange={(open) => (creatingOrg ? null : setOrgOpen(open))}
        title="New organisation"
        description="You can invite its org admin once it's created."
        footer={
          <>
            <Button variant="outline" disabled={creatingOrg} onClick={() => setOrgOpen(false)}>Cancel</Button>
            <Button disabled={creatingOrg} onClick={() => void createOrg()}>
              {creatingOrg ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {creatingOrg ? "Creating…" : "Create organisation"}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <FormField label="Name" required error={orgErrors.name}>
            <Input
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                if (!slugTouched) setOrgSlug(toSlug(e.target.value));
              }}
            />
          </FormField>
          <FormField label="Web address" required error={orgErrors.slug} help="Used in event links. It's hard to change later.">
            <Input
              value={orgSlug}
              autoCapitalize="none"
              onChange={(e) => {
                setSlugTouched(true);
                setOrgSlug(e.target.value.toLowerCase());
              }}
            />
          </FormField>
          <FormField label="Address" optional help="Printed on receipts.">
            <Textarea value={orgAddress} maxLength={500} onChange={(e) => setOrgAddress(e.target.value)} />
          </FormField>
        </div>
      </SidePanel>

      <SidePanel
        open={adminOpen}
        onOpenChange={(open) => (grantingAdmin ? null : setAdminOpen(open))}
        title="Add platform admin"
        description="This person will be able to access every organisation."
        footer={
          <>
            <Button variant="outline" disabled={grantingAdmin} onClick={() => setAdminOpen(false)}>Cancel</Button>
            <Button disabled={grantingAdmin} onClick={() => void grantAdmin()}>
              {grantingAdmin ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {grantingAdmin ? "Adding…" : "Add platform admin"}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <FormField label="Email" required error={adminEmailError}>
            <Input type="email" inputMode="email" autoComplete="off" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </FormField>
          <FormField label="Full name" optional>
            <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          </FormField>
        </div>
      </SidePanel>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="Revoke platform admin?"
        description={revokeTarget ? `${revokeTarget.fullName || revokeTarget.email} will lose access to all organisations they aren't a member of.` : ""}
        confirmLabel="Revoke access"
        destructive
        loading={revoking}
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
