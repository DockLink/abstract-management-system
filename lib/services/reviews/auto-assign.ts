import {
  prisma,
} from "@/lib/db/prisma";
import {
  EventRoleType,
  ReviewAssignmentStatus,
  SubmissionStatus,
  ReviewerInviteStatus,
} from "@/app/generated/prisma/client";

export interface AutoAssignOptions {
  orgId: string;
  eventId: string;
  reviewersPerAbstract?: number;
  categoryId?: string | null;
  balanceLoad?: boolean;
  skipSameInstitution?: boolean;
  dueAt?: Date | null;
}

export interface AutoAssignResult {
  totalSubmissionsProcessed: number;
  assignmentsCreated: number;
  skippedSameInstitutionCount: number;
  unfulfilledSubmissions: Array<{
    submissionId: string;
    refNo: string | null;
    title: string;
    currentCount: number;
    targetCount: number;
  }>;
}

function normalizeInstitution(inst: string | null | undefined): string {
  if (!inst) return "";
  return inst.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function runAutoAssign(options: AutoAssignOptions): Promise<AutoAssignResult> {
  const {
    orgId,
    eventId,
    reviewersPerAbstract = 2,
    categoryId,
    skipSameInstitution = true,
    dueAt,
  } = options;

  // 1. Fetch eligible submissions
  const submissionWhere: Record<string, unknown> = {
    orgId,
    eventId,
    status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW] },
    deletedAt: null,
  };
  if (categoryId) {
    submissionWhere.categoryId = categoryId;
  }

  const submissions = await prisma.submission.findMany({
    where: submissionWhere,
    include: {
      authors: true,
      reviewAssignments: {
        where: { status: { not: ReviewAssignmentStatus.CONFLICT } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // 2. Fetch all reviewers for this event
  const reviewerRoles = await prisma.eventRole.findMany({
    where: {
      eventId,
      role: EventRoleType.REVIEWER,
      invitationStatus: { not: ReviewerInviteStatus.DECLINED },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          institution: true,
        },
      },
    },
  });

  if (reviewerRoles.length === 0) {
    return {
      totalSubmissionsProcessed: submissions.length,
      assignmentsCreated: 0,
      skippedSameInstitutionCount: 0,
      unfulfilledSubmissions: submissions.map((s) => ({
        submissionId: s.id,
        refNo: s.refNo,
        title: s.title,
        currentCount: s.reviewAssignments.length,
        targetCount: reviewersPerAbstract,
      })),
    };
  }

  // 3. Count current active assignments per reviewer in this event
  const currentAssignments = await prisma.reviewAssignment.groupBy({
    by: ["reviewerId"],
    where: {
      eventId,
      status: { not: ReviewAssignmentStatus.CONFLICT },
    },
    _count: { id: true },
  });

  const assignmentCountMap = new Map<string, number>();
  for (const item of currentAssignments) {
    assignmentCountMap.set(item.reviewerId, item._count.id);
  }

  // Local state to track dynamically assigned reviewers during this run
  type ReviewerCandidate = {
    userId: string;
    email: string;
    institutionNorm: string;
    maxLoad: number;
    categoryIds: string[];
    currentLoad: number;
  };

  const reviewers: ReviewerCandidate[] = reviewerRoles.map((r) => ({
    userId: r.userId,
    email: r.user.email.toLowerCase(),
    institutionNorm: normalizeInstitution(r.user.institution),
    maxLoad: r.maxLoad ?? 20,
    categoryIds: r.categoryIds ?? [],
    currentLoad: assignmentCountMap.get(r.userId) ?? 0,
  }));

  let assignmentsCreated = 0;
  let skippedSameInstitutionCount = 0;
  const unfulfilledSubmissions: AutoAssignResult["unfulfilledSubmissions"] = [];

  const newAssignmentsToCreate: Array<{
    orgId: string;
    eventId: string;
    submissionId: string;
    reviewerId: string;
    dueAt: Date | null;
  }> = [];

  const submissionsToUpdateStatus: string[] = [];

  // 4. Assign reviewers per submission
  for (const submission of submissions) {
    const existingReviewerIds = new Set(submission.reviewAssignments.map((a) => a.reviewerId));
    const currentCount = existingReviewerIds.size;
    const needed = Math.max(0, reviewersPerAbstract - currentCount);

    if (needed === 0) continue;

    // Authors data for conflict check
    const authorEmails = new Set(
      submission.authors.map((a) => a.email.toLowerCase().trim()),
    );
    const authorInstitutions = new Set(
      submission.authors
        .map((a) => normalizeInstitution(a.institution))
        .filter((inst) => inst.length > 0),
    );

    // Filter valid candidate reviewers
    const eligibleReviewers: ReviewerCandidate[] = [];

    for (const reviewer of reviewers) {
      // Cannot already be assigned
      if (existingReviewerIds.has(reviewer.userId)) continue;

      // Cannot be an author on this submission
      if (authorEmails.has(reviewer.email)) continue;

      // Cannot exceed max load
      if (reviewer.currentLoad >= reviewer.maxLoad) continue;

      // Category expertise check:
      // If reviewer has categoryIds configured, it MUST include the submission's category
      if (
        reviewer.categoryIds.length > 0 &&
        submission.categoryId &&
        !reviewer.categoryIds.includes(submission.categoryId)
      ) {
        continue;
      }

      // Same institution check (REV-06)
      if (skipSameInstitution && reviewer.institutionNorm) {
        if (authorInstitutions.has(reviewer.institutionNorm)) {
          skippedSameInstitutionCount++;
          continue;
        }
      }

      eligibleReviewers.push(reviewer);
    }

    // Sort eligible candidates by currentLoad ascending (load balancing)
    eligibleReviewers.sort((a, b) => a.currentLoad - b.currentLoad);

    const chosen = eligibleReviewers.slice(0, needed);

    for (const candidate of chosen) {
      newAssignmentsToCreate.push({
        orgId,
        eventId,
        submissionId: submission.id,
        reviewerId: candidate.userId,
        dueAt: dueAt ?? null,
      });

      // Update in-memory state
      candidate.currentLoad++;
      existingReviewerIds.add(candidate.userId);
      assignmentsCreated++;
    }

    if (submission.status === SubmissionStatus.SUBMITTED && chosen.length > 0) {
      submissionsToUpdateStatus.push(submission.id);
    }

    const finalCount = currentCount + chosen.length;
    if (finalCount < reviewersPerAbstract) {
      unfulfilledSubmissions.push({
        submissionId: submission.id,
        refNo: submission.refNo,
        title: submission.title,
        currentCount: finalCount,
        targetCount: reviewersPerAbstract,
      });
    }
  }

  // 5. Persist to database in batch
  if (newAssignmentsToCreate.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.reviewAssignment.createMany({
        data: newAssignmentsToCreate,
        skipDuplicates: true,
      });

      if (submissionsToUpdateStatus.length > 0) {
        await tx.submission.updateMany({
          where: { id: { in: submissionsToUpdateStatus } },
          data: { status: SubmissionStatus.UNDER_REVIEW },
        });
      }
    });
  }

  return {
    totalSubmissionsProcessed: submissions.length,
    assignmentsCreated,
    skippedSameInstitutionCount,
    unfulfilledSubmissions,
  };
}

