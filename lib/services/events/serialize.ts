import type { Event } from "@/app/generated/prisma/client";
import { derivePortalState } from "./portal-state";

export function serializeEvent(event: Event) {
  return {
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
    settings: event.settings,
    keyDates: {
      submissionOpenAt: event.submissionOpenAt?.toISOString() ?? null,
      submissionCloseAt: event.submissionCloseAt?.toISOString() ?? null,
      reviewDeadlineAt: event.reviewDeadlineAt?.toISOString() ?? null,
      notificationAt: event.notificationAt?.toISOString() ?? null,
      earlyBirdEndAt: event.earlyBirdEndAt?.toISOString() ?? null,
      registrationCloseAt: event.registrationCloseAt?.toISOString() ?? null,
    },
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function serializePublicEvent(
  event: Event,
  org: { name: string; slug: string; logoPath: string | null },
) {
  const portalState = derivePortalState(event);
  return {
    organisation: {
      name: org.name,
      slug: org.slug,
      logoPath: org.logoPath,
    },
    event: {
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
      keyDates: {
        submissionOpenAt: event.submissionOpenAt?.toISOString() ?? null,
        submissionCloseAt: event.submissionCloseAt?.toISOString() ?? null,
        reviewDeadlineAt: event.reviewDeadlineAt?.toISOString() ?? null,
        notificationAt: event.notificationAt?.toISOString() ?? null,
        earlyBirdEndAt: event.earlyBirdEndAt?.toISOString() ?? null,
        registrationCloseAt: event.registrationCloseAt?.toISOString() ?? null,
      },
    },
    portalState,
  };
}
