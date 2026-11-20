import { AdminDecisionsPage } from "@/components/decisions/admin-decisions-page";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";

export const instant = false;

export default async function AdminDecisionsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  return (
    <AdminDecisionsPage
      orgId={orgId}
      eventId={eventId}
      orgSlug={orgSlug}
      eventSlug={eventSlug}
    />
  );
}

