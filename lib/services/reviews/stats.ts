import {
  prisma,
} from "@/lib/db/prisma";
import {
  EventRoleType,
  ReviewAssignmentStatus,
  ReviewRecommendation,
  SubmissionStatus,
} from "@/app/generated/prisma/client";

export interface ProgressSummary {
  overview: {
    totalSubmissions: number;
    underReviewSubmissions: number;
    totalAssignments: number;
    completedAssignments: number;
    inProgressAssignments: number;
    pendingAssignments: number;
    conflictAssignments: number;
    percentComplete: number;
  };
  reviewers: Array<{
    userId: string;
    email: string;
    fullName: string | null;
    institution: string | null;
    maxLoad: number;
    assignedCount: number;
    completedCount: number;
    inProgressCount: number;
    pendingCount: number;
    conflictCount: number;
    percentComplete: number;
    lastReviewAt: string | null;
  }>;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    submissionCount: number;
    assignedCount: number;
    completedCount: number;
    percentComplete: number;
  }>;
}

export async function getReviewProgress(orgId: string, eventId: string): Promise<ProgressSummary> {
  const [submissions, assignments, reviewerRoles, categories] = await Promise.all([
    prisma.submission.findMany({
      where: { orgId, eventId, deletedAt: null },
      select: { id: true, status: true, categoryId: true },
    }),
    prisma.reviewAssignment.findMany({
      where: { orgId, eventId },
      include: {
        review: {
          select: { submittedAt: true, isDraft: true },
        },
      },
    }),
    prisma.eventRole.findMany({
      where: { eventId, role: EventRoleType.REVIEWER },
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
    }),
    prisma.category.findMany({
      where: { orgId, eventId },
      select: { id: true, name: true },
    }),
  ]);

  const totalSubmissions = submissions.length;
  const underReviewSubmissions = submissions.filter(
    (s) => s.status === SubmissionStatus.UNDER_REVIEW,
  ).length;

  let completedCount = 0;
  let inProgressCount = 0;
  let pendingCount = 0;
  let conflictCount = 0;

  for (const a of assignments) {
    if (a.status === ReviewAssignmentStatus.COMPLETED) completedCount++;
    else if (a.status === ReviewAssignmentStatus.IN_PROGRESS) inProgressCount++;
    else if (a.status === ReviewAssignmentStatus.CONFLICT) conflictCount++;
    else pendingCount++;
  }

  const activeAssignmentsTotal = assignments.length - conflictCount;
  const overallPercentComplete =
    activeAssignmentsTotal > 0
      ? Math.round((completedCount / activeAssignmentsTotal) * 100)
      : 0;

  // Reviewer breakdown
  const reviewerStats = reviewerRoles.map((role) => {
    const userAssignments = assignments.filter((a) => a.reviewerId === role.userId);
    const rCompleted = userAssignments.filter(
      (a) => a.status === ReviewAssignmentStatus.COMPLETED,
    ).length;
    const rInProgress = userAssignments.filter(
      (a) => a.status === ReviewAssignmentStatus.IN_PROGRESS,
    ).length;
    const rConflict = userAssignments.filter(
      (a) => a.status === ReviewAssignmentStatus.CONFLICT,
    ).length;
    const rPending = userAssignments.filter(
      (a) => a.status === ReviewAssignmentStatus.PENDING,
    ).length;

    const rActiveTotal = userAssignments.length - rConflict;
    const rPercent =
      rActiveTotal > 0 ? Math.round((rCompleted / rActiveTotal) * 100) : 0;

    // Find latest submitted review date
    let lastReviewAt: Date | null = null;
    for (const a of userAssignments) {
      if (a.review?.submittedAt) {
        if (!lastReviewAt || a.review.submittedAt > lastReviewAt) {
          lastReviewAt = a.review.submittedAt;
        }
      }
    }

    return {
      userId: role.userId,
      email: role.user.email,
      fullName: role.user.fullName,
      institution: role.user.institution,
      maxLoad: role.maxLoad ?? 20,
      assignedCount: userAssignments.length,
      completedCount: rCompleted,
      inProgressCount: rInProgress,
      pendingCount: rPending,
      conflictCount: rConflict,
      percentComplete: rPercent,
      lastReviewAt: lastReviewAt ? lastReviewAt.toISOString() : null,
    };
  });

  // Category breakdown
  const submissionCategoryMap = new Map<string, string | null>();
  for (const s of submissions) {
    submissionCategoryMap.set(s.id, s.categoryId);
  }

  const categoryStats = categories.map((cat) => {
    const catSubmissions = submissions.filter((s) => s.categoryId === cat.id);
    const catSubIds = new Set(catSubmissions.map((s) => s.id));

    const catAssignments = assignments.filter((a) => catSubIds.has(a.submissionId));
    const catCompleted = catAssignments.filter(
      (a) => a.status === ReviewAssignmentStatus.COMPLETED,
    ).length;
    const catActive = catAssignments.filter(
      (a) => a.status !== ReviewAssignmentStatus.CONFLICT,
    ).length;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      submissionCount: catSubmissions.length,
      assignedCount: catAssignments.length,
      completedCount: catCompleted,
      percentComplete:
        catActive > 0 ? Math.round((catCompleted / catActive) * 100) : 0,
    };
  });

  return {
    overview: {
      totalSubmissions,
      underReviewSubmissions,
      totalAssignments: assignments.length,
      completedAssignments: completedCount,
      inProgressAssignments: inProgressCount,
      pendingAssignments: pendingCount,
      conflictAssignments: conflictCount,
      percentComplete: overallPercentComplete,
    },
    reviewers: reviewerStats,
    categories: categoryStats,
  };
}

export interface ReviewScoreDetail {
  reviewerId: string;
  reviewerName: string | null;
  recommendation: ReviewRecommendation | null;
  weightedScore: number;
  criterionScores: Array<{
    criterionId: string;
    criterionName: string;
    score: number;
    weight: number;
  }>;
  commentAuthor: string | null;
  commentCommittee: string | null;
  submittedAt: string | null;
}

export interface SubmissionScoreRow {
  submissionId: string;
  refNo: string | null;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  preferredPresentationType: string | null;
  completedReviewCount: number;
  assignedReviewCount: number;
  averageScore: number;
  weightedAverageScore: number;
  standardDeviation: number;
  scoreGap: number;
  isDisputed: boolean;
  disputeReason: string | null;
  reviews: ReviewScoreDetail[];
}

export function computeStandardDeviation(numbers: number[]): number {
  if (numbers.length <= 1) return 0;
  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const variance =
    numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / (numbers.length - 1);
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

export async function getScoresTable(options: {
  orgId: string;
  eventId: string;
  categoryId?: string;
  disagreementThreshold?: number;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: SubmissionScoreRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const {
    orgId,
    eventId,
    categoryId,
    disagreementThreshold = 2.0,
    search,
    page = 1,
    limit = 20,
  } = options;

  const where: Record<string, unknown> = {
    orgId,
    eventId,
    deletedAt: null,
    status: {
      in: [
        SubmissionStatus.SUBMITTED,
        SubmissionStatus.UNDER_REVIEW,
        SubmissionStatus.REVISIONS_REQUESTED,
        SubmissionStatus.ACCEPTED,
        SubmissionStatus.REJECTED,
        SubmissionStatus.WAITLISTED,
        SubmissionStatus.CONFIRMED,
      ],
    },
  };

  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { refNo: { contains: search, mode: "insensitive" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [submissions, total, criteria] = await Promise.all([
    prisma.submission.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        reviewAssignments: {
          include: {
            reviewer: { select: { id: true, fullName: true, email: true } },
            review: {
              include: {
                scores: {
                  include: {
                    criterion: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.submission.count({ where }),
    prisma.rubricCriterion.findMany({
      where: { orgId, eventId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const criteriaMap = new Map(criteria.map((c) => [c.id, c]));

  const rows: SubmissionScoreRow[] = submissions.map((sub) => {
    const validAssignments = sub.reviewAssignments.filter(
      (a) => a.status !== ReviewAssignmentStatus.CONFLICT,
    );
    const completedReviews: ReviewScoreDetail[] = [];

    for (const assignment of validAssignments) {
      const review = assignment.review;
      if (!review || review.isDraft) continue;

      let totalWeightedScore = 0;
      let totalWeight = 0;
      const criterionScores: ReviewScoreDetail["criterionScores"] = [];

      for (const s of review.scores) {
        const crit = criteriaMap.get(s.criterionId) ?? s.criterion;
        const weight = crit?.weight ?? 1.0;
        totalWeightedScore += s.score * weight;
        totalWeight += weight;

        criterionScores.push({
          criterionId: s.criterionId,
          criterionName: crit?.name ?? "Criterion",
          score: s.score,
          weight,
        });
      }

      const weightedScore =
        totalWeight > 0
          ? Math.round((totalWeightedScore / totalWeight) * 100) / 100
          : 0;

      completedReviews.push({
        reviewerId: assignment.reviewer.id,
        reviewerName: assignment.reviewer.fullName || assignment.reviewer.email,
        recommendation: review.recommendation,
        weightedScore,
        criterionScores,
        commentAuthor: review.commentAuthor,
        commentCommittee: review.commentCommittee,
        submittedAt: review.submittedAt ? review.submittedAt.toISOString() : null,
      });
    }

    const scoresList = completedReviews.map((r) => r.weightedScore);
    const averageScore =
      scoresList.length > 0
        ? Math.round(
            (scoresList.reduce((sum, s) => sum + s, 0) / scoresList.length) * 100,
          ) / 100
        : 0;

    const stdDev = computeStandardDeviation(scoresList);
    const minScore = scoresList.length > 0 ? Math.min(...scoresList) : 0;
    const maxScore = scoresList.length > 0 ? Math.max(...scoresList) : 0;
    const scoreGap = scoresList.length > 1 ? Math.round((maxScore - minScore) * 100) / 100 : 0;

    // Check dispute conditions:
    // 1. Score gap exceeds threshold
    // 2. Conflicting recommendations (e.g. Accept vs Reject)
    let isDisputed = false;
    const disputeReasons: string[] = [];

    if (scoresList.length > 1 && scoreGap >= disagreementThreshold) {
      isDisputed = true;
      disputeReasons.push(`Score gap of ${scoreGap} exceeds threshold (${disagreementThreshold})`);
    }

    const recommendations = completedReviews
      .map((r) => r.recommendation)
      .filter((rec): rec is ReviewRecommendation => rec !== null);

    const hasAccept = recommendations.some(
      (r) => r === ReviewRecommendation.ACCEPT_ORAL || r === ReviewRecommendation.ACCEPT_POSTER,
    );
    const hasReject = recommendations.some((r) => r === ReviewRecommendation.REJECT);

    if (hasAccept && hasReject) {
      isDisputed = true;
      disputeReasons.push("Conflicting recommendations: Accept vs Reject");
    }

    return {
      submissionId: sub.id,
      refNo: sub.refNo,
      title: sub.title,
      categoryId: sub.categoryId,
      categoryName: sub.category?.name ?? null,
      preferredPresentationType: sub.preferredPresentationType,
      completedReviewCount: completedReviews.length,
      assignedReviewCount: validAssignments.length,
      averageScore,
      weightedAverageScore: averageScore,
      standardDeviation: stdDev,
      scoreGap,
      isDisputed,
      disputeReason: disputeReasons.length > 0 ? disputeReasons.join("; ") : null,
      reviews: completedReviews,
    };
  });

  return {
    data: rows,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

