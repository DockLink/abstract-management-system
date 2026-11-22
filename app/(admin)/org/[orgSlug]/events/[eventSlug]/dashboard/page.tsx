import { EventDashboard } from "@/components/setup/event-dashboard";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";

export const instant = false;

export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);
  return <EventDashboard orgId={orgId} eventId={eventId} orgSlug={orgSlug} eventSlug={eventSlug} />;
}
