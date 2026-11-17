import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "./audit";

export async function cloneEvent(input: {
  sourceEventId: string;
  orgId: string;
  name: string;
  slug: string;
  edition?: string | null;
  actorId: string;
}) {
  const source = await prisma.event.findFirst({
    where: {
      id: input.sourceEventId,
      orgId: input.orgId,
      deletedAt: null,
    },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      submissionTypes: { orderBy: { sortOrder: "asc" } },
      presentationTypes: { orderBy: { sortOrder: "asc" } },
      eligibilityRule: true,
    },
  });

  if (!source) {
    return { ok: false as const, reason: "NOT_FOUND" as const };
  }

  const existing = await prisma.event.findUnique({
    where: { orgId_slug: { orgId: input.orgId, slug: input.slug } },
  });
  if (existing) {
    return { ok: false as const, reason: "SLUG_CONFLICT" as const };
  }

  const cloned = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        orgId: input.orgId,
        name: input.name,
        slug: input.slug,
        edition: input.edition ?? source.edition,
        venue: source.venue,
        startsAt: source.startsAt,
        endsAt: source.endsAt,
        logoPath: source.logoPath,
        bannerPath: source.bannerPath,
        contactEmail: source.contactEmail,
        contactPhone: source.contactPhone,
        guidelinesRichText: source.guidelinesRichText,
        guidelinesPdfPath: source.guidelinesPdfPath,
        primaryColor: source.primaryColor,
        blindMode: source.blindMode,
        settings: source.settings ?? {},
        submissionOpenAt: source.submissionOpenAt,
        submissionCloseAt: source.submissionCloseAt,
        reviewDeadlineAt: source.reviewDeadlineAt,
        notificationAt: source.notificationAt,
        earlyBirdEndAt: source.earlyBirdEndAt,
        registrationCloseAt: source.registrationCloseAt,
        categories: {
          create: source.categories.map((c) => ({
            orgId: input.orgId,
            name: c.name,
            chairUserId: c.chairUserId,
            sortOrder: c.sortOrder,
          })),
        },
        submissionTypes: {
          create: source.submissionTypes.map((t) => ({
            orgId: input.orgId,
            name: t.name,
            wordLimit: t.wordLimit,
            sections: t.sections ?? [],
            requiresErc: t.requiresErc,
            sortOrder: t.sortOrder,
          })),
        },
        presentationTypes: {
          create: source.presentationTypes.map((t) => ({
            orgId: input.orgId,
            code: t.code,
            label: t.label,
            isActive: t.isActive,
            sortOrder: t.sortOrder,
          })),
        },
        ...(source.eligibilityRule
          ? {
              eligibilityRule: {
                create: {
                  orgId: input.orgId,
                  maxAbstractsPerAuthor:
                    source.eligibilityRule.maxAbstractsPerAuthor,
                  requireMemberAuthor:
                    source.eligibilityRule.requireMemberAuthor,
                  presentingAuthorMustRegister:
                    source.eligibilityRule.presentingAuthorMustRegister,
                },
              },
            }
          : {}),
      },
      include: {
        categories: true,
        submissionTypes: true,
        presentationTypes: true,
        eligibilityRule: true,
      },
    });

    return event;
  });

  await writeAuditLog({
    orgId: input.orgId,
    eventId: cloned.id,
    actorId: input.actorId,
    action: "event.clone",
    entity: "Event",
    entityId: cloned.id,
    before: { sourceEventId: source.id },
    after: { id: cloned.id, slug: cloned.slug },
  });

  return { ok: true as const, event: cloned };
}
