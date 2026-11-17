import { CategoriesPage } from "@/components/setup/categories-page";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";

export const instant = false;

export default async function CategoriesRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  return <CategoriesPage orgId={orgId} eventId={eventId} />;
}
