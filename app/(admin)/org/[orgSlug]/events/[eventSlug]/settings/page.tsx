import { SettingsPage } from "@/components/setup/settings-page";
import { apiFetchServer } from "@/lib/api/server";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";
import type { EventDto } from "@/lib/types/api";

export const instant = false;

export default async function SettingsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { orgId, eventId, org, event } = await resolveOrgEventBySlug(
    orgSlug,
    eventSlug,
  );

  const result = await apiFetchServer<EventDto>(
    `/api/v1/orgs/${orgId}/events/${eventId}`,
  );

  const eventDto = result.ok
    ? result.data
    : {
        id: event.id,
        orgId: event.orgId,
        name: event.name,
        slug: event.slug,
        edition: event.edition,
        venue: event.venue,
        startsAt: event.startsAt?.toISOString() ?? null,
        endsAt: event.endsAt?.toISOString() ?? null,
        logoPath: event.logoPath,
        bannerPath: event.bannerPath,
        contactEmail: event.contactEmail,
        contactPhone: event.contactPhone,
        guidelinesRichText: event.guidelinesRichText,
        guidelinesPdfPath: event.guidelinesPdfPath,
        primaryColor: event.primaryColor,
        blindMode: event.blindMode,
        settings:
          typeof event.settings === "object" && event.settings !== null
            ? (event.settings as Record<string, unknown>)
            : {},
        keyDates: {
          submissionOpenAt: event.submissionOpenAt?.toISOString() ?? null,
          submissionCloseAt: event.submissionCloseAt?.toISOString() ?? null,
          reviewDeadlineAt: event.reviewDeadlineAt?.toISOString() ?? null,
          notificationAt: event.notificationAt?.toISOString() ?? null,
          earlyBirdEndAt: event.earlyBirdEndAt?.toISOString() ?? null,
          registrationCloseAt:
            event.registrationCloseAt?.toISOString() ?? null,
        },
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      };

  return (
    <SettingsPage
      orgId={orgId}
      orgSlug={org.slug}
      eventId={eventId}
      event={eventDto}
    />
  );
}
