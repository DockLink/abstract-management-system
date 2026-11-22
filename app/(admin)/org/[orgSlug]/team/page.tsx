import { connection } from "next/server";
import { redirect } from "next/navigation";
import { OrgTeamPage } from "@/components/setup/org-team-page";
import { OrgShell } from "@/components/shell/org-shell";
import { loadOrgShellData } from "@/lib/nav/shell-data";

export const instant = false;

export default async function OrgTeamRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await connection();
  const shell = await loadOrgShellData(orgSlug);
  // Presentation only: the members API enforces org admin itself.
  if (!shell.canManageOrg) redirect(`/org/${orgSlug}`);

  return (
    <OrgShell data={shell}>
      <OrgTeamPage orgId={shell.org.id} orgName={shell.org.name} />
    </OrgShell>
  );
}
