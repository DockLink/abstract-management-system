import { connection } from "next/server";
import { EventsListPage } from "@/components/setup/events-list-page";
import { OrgShell } from "@/components/shell/org-shell";
import { loadOrgShellData } from "@/lib/nav/shell-data";
import { apiFetchServer } from "@/lib/api/server";
import { resolveOrgBySlug } from "@/lib/events/resolve";
import type { EventDto } from "@/lib/types/api";

export const instant = false;

export default async function OrgEventsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // Event status chips depend on the current time: render per request.
  await connection();
  const [org, shell] = await Promise.all([
    resolveOrgBySlug(orgSlug),
    loadOrgShellData(orgSlug),
  ]);

  const result = await apiFetchServer<EventDto[]>(
    `/api/v1/orgs/${org.id}/events`,
  );

  const events = result.ok ? result.data : [];

  return (
    <OrgShell data={shell}>
      <EventsListPage
        orgSlug={org.slug}
        orgId={org.id}
        orgName={org.name}
        events={events}
      />
    </OrgShell>
  );
}
