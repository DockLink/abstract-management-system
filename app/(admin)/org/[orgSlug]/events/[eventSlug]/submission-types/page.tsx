import { SubmissionTypesPage } from "@/components/setup/submission-types-page";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";

export const instant = false;

export default async function SubmissionTypesRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  return <SubmissionTypesPage orgId={orgId} eventId={eventId} />;
}
