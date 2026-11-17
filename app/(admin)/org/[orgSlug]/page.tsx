import { EventsListPage } from "@/components/setup/events-list-page";
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
  const org = await resolveOrgBySlug(orgSlug);

  const result = await apiFetchServer<EventDto[]>(
    `/api/v1/orgs/${org.id}/events`,
  );

  const events = result.ok ? result.data : [];

  return (
    <EventsListPage
      orgSlug={org.slug}
      orgId={org.id}
      orgName={org.name}
      events={events}
    />
  );
}
