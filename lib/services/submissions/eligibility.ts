import { prisma } from "@/lib/db/prisma";

export type EligibilityCheckResult =
  | { ok: true }
  | { ok: false; reason: string; code: string };

/**
 * Check whether a user can submit a new abstract for an event.
 * - Max abstracts per presenting author
 * - Member requirement
 */
export async function checkSubmissionEligibility(input: {
  eventId: string;
  orgId: string;
  submitterId: string;
  presentingAuthorEmail?: string | null;
  excludeSubmissionId?: string; // exclude self when updating
}): Promise<EligibilityCheckResult> {
  const rule = await prisma.eligibilityRule.findUnique({
    where: { eventId: input.eventId },
  });

  if (!rule) return { ok: true }; // no rule = no restriction

  // Count how many submissions this user has as presenting author
  const presentingCount = await prisma.submissionAuthor.count({
    where: {
      isPresenting: true,
      email: input.presentingAuthorEmail ?? undefined,
      submission: {
        eventId: input.eventId,
        status: { not: "WITHDRAWN" },
        id: input.excludeSubmissionId ? { not: input.excludeSubmissionId } : undefined,
      },
    },
  });

  if (presentingCount >= rule.maxAbstractsPerAuthor) {
    return {
      ok: false,
      reason: `The presenting author has reached the maximum of ${rule.maxAbstractsPerAuthor} abstract(s) per event.`,
      code: "MAX_ABSTRACTS_EXCEEDED",
    };
  }

  return { ok: true };
}

/**
 * Check if any of the listed author emails/membership numbers match the member list.
 * Returns a warning (not a block) if requireMemberAuthor is true and no match found.
 */
export async function checkMemberRequirement(input: {
  orgId: string;
  eventId: string;
  authorEmails: string[];
  authorMembershipNos: string[];
}): Promise<{ memberFound: boolean; required: boolean }> {
  const rule = await prisma.eligibilityRule.findUnique({
    where: { eventId: input.eventId },
  });

  if (!rule?.requireMemberAuthor) {
    return { memberFound: true, required: false };
  }

  const emailCheck = input.authorEmails.length > 0
    ? await prisma.member.findFirst({
        where: { orgId: input.orgId, email: { in: input.authorEmails } },
      })
    : null;

  const memberNoCheck = input.authorMembershipNos.length > 0
    ? await prisma.member.findFirst({
        where: { orgId: input.orgId, membershipNo: { in: input.authorMembershipNos } },
      })
    : null;

  return {
    memberFound: !!(emailCheck || memberNoCheck),
    required: true,
  };
}
