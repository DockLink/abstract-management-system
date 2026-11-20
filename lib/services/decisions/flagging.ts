import { prisma } from "@/lib/db/prisma";
import { SubmissionStatus } from "@/app/generated/prisma/client";
import { registrationDueAt } from "./settings";

export async function flagUnregisteredSubmissions(
  orgId: string,
  eventId: string,
): Promise<{ flaggedCount: number; alreadyFlaggedCount: number }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { settings: true, registrationCloseAt: true },
  });
  if (!event) throw new Error("Event not found");

  const dueDate = registrationDueAt(event);
  if (!dueDate) {
    return { flaggedCount: 0, alreadyFlaggedCount: 0 };
  }

  const now = new Date();
  if (now <= dueDate) {
    // Due date has not passed yet
    return { flaggedCount: 0, alreadyFlaggedCount: 0 };
  }

  // Find accepted submissions that are not confirmed and have no registration flag yet
  const acceptedUnregistered = await prisma.submission.findMany({
    where: {
      orgId,
      eventId,
      deletedAt: null,
      status: SubmissionStatus.ACCEPTED,
    },
    select: { id: true, registrationFlaggedAt: true },
  });

  const toFlag = acceptedUnregistered.filter((s) => s.registrationFlaggedAt === null);
  const alreadyFlagged = acceptedUnregistered.length - toFlag.length;

  if (toFlag.length > 0) {
    await prisma.submission.updateMany({
      where: { id: { in: toFlag.map((s) => s.id) } },
      data: { registrationFlaggedAt: now },
    });
  }

  return {
    flaggedCount: toFlag.length,
    alreadyFlaggedCount: alreadyFlagged,
  };
}

/**
 * DEC-09 / TKT-11: Marks an abstract as Confirmed when registration is completed and paid.
 */
export async function confirmSubmissionRegistration(
  submissionId: string,
): Promise<{ success: boolean }> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) throw new Error("Submission not found");

  if (submission.status !== SubmissionStatus.ACCEPTED) {
    // Can only confirm accepted submissions
    return { success: false };
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: SubmissionStatus.CONFIRMED,
      confirmedAt: new Date(),
    },
  });

  return { success: true };
}

