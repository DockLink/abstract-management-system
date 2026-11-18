import { AdminSubmissionsPage } from "@/components/setup/admin-submissions-page";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";

export const instant = false;

export default async function SubmissionsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  return <AdminSubmissionsPage orgId={orgId} eventId={eventId} />;
}

