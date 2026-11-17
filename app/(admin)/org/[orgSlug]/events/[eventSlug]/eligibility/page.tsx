import { EligibilityPage } from "@/components/setup/eligibility-page";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";

export const instant = false;

export default async function EligibilityRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  return <EligibilityPage orgId={orgId} eventId={eventId} />;
}
