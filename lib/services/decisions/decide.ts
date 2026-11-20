import { prisma } from "@/lib/db/prisma";
import {
  DecisionOutcome,
  DecisionSource,
} from "@/app/generated/prisma/client";
import { presentationTypeForDecision } from "./state-machine";
import type { DecisionAccess } from "./access";

export async function setSubmissionsDecision(
  orgId: string,
  eventId: string,
  access: DecisionAccess,
  actorId: string,
  submissionIds: string[],
  decision: DecisionOutcome | null,
  note?: string,
): Promise<{ updatedCount: number; isRecommendationOnly: boolean }> {
  // Validate that submissions belong to this event and (if chair) their allowed categories
  const where: Record<string, unknown> = {
    id: { in: submissionIds },
    orgId,
    eventId,
    deletedAt: null,
  };

  if (access.categoryIds !== null) {
    where.categoryId = { in: access.categoryIds };
  }

  const submissions = await prisma.submission.findMany({
    where,
    select: { id: true, status: true, decision: true, decisionReleasedAt: true },
  });

  if (submissions.length === 0) {
    return { updatedCount: 0, isRecommendationOnly: !access.canDecide };
  }

  const now = new Date();
  const validIds = submissions
    .filter((s) => {
      // Cannot change decision once released unless reversing via explicit flow
      // or if clearing an unreleased decision
      return s.decisionReleasedAt == null;
    })
    .map((s) => s.id);

  if (validIds.length === 0) {
    return { updatedCount: 0, isRecommendationOnly: !access.canDecide };
  }

  if (!access.canDecide) {
    // Track chair without final decision rights -> records recommendation
    await prisma.submission.updateMany({
      where: { id: { in: validIds } },
      data: {
        chairRecommendation: decision,
        chairRecommendedAt: now,
        chairRecommendedById: actorId,
      },
    });
    return { updatedCount: validIds.length, isRecommendationOnly: true };
  }

  // Admin or empowered chair -> sets provisional / actual decision
  const presType = decision ? presentationTypeForDecision(decision) : null;

  await prisma.submission.updateMany({
    where: { id: { in: validIds } },
    data: {
      decision,
      presentationType: presType,
      decisionNote: note ?? null,
      decidedAt: decision ? now : null,
      decidedById: decision ? actorId : null,
      decisionSource: decision ? DecisionSource.MANUAL : null,
    },
  });

  return { updatedCount: validIds.length, isRecommendationOnly: false };
}
