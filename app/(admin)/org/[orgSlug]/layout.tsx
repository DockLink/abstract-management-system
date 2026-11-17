import { AdminAppShell } from "@/components/setup/admin-app-shell";
import { resolveOrgBySlug } from "@/lib/events/resolve";

export const instant = false;

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await resolveOrgBySlug(orgSlug);

  return (
    <AdminAppShell orgSlug={org.slug} orgName={org.name}>
      {children}
    </AdminAppShell>
  );
}
