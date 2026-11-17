import { PageHeader } from "@/components/shared/page-header";
import { SetupTabs } from "@/components/setup/setup-tabs";
import { apiFetchServer } from "@/lib/api/server";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";
import { createSignedAssetUrl } from "@/lib/services/events/storage";
import type { EventDto } from "@/lib/types/api";

export const instant = false;

async function signedUrl(path: string | null) {
  if (!path) return null;
  return createSignedAssetUrl(path);
}

export default async function EventSetupPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  const result = await apiFetchServer<EventDto>(
    `/api/v1/orgs/${orgId}/events/${eventId}`,
  );

  if (!result.ok) {
    return (
      <p className="text-sm text-destructive">
        Could not load event: {result.error.message}
      </p>
    );
  }

  const event = result.data;
  const [logoUrl, bannerUrl, guidelinesPdfUrl] = await Promise.all([
    signedUrl(event.logoPath),
    signedUrl(event.bannerPath),
    signedUrl(event.guidelinesPdfPath),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event setup"
        description="Configure basics, the public page, and submission milestones."
      />
      <SetupTabs
        orgId={orgId}
        eventId={eventId}
        orgSlug={orgSlug}
        eventSlug={eventSlug}
        event={event}
        logoUrl={logoUrl}
        bannerUrl={bannerUrl}
        guidelinesPdfUrl={guidelinesPdfUrl}
      />
    </div>
  );
}
