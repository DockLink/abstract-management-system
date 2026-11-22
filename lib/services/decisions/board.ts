import { prisma } from "@/lib/db/prisma";
import {
  DecisionOutcome,
  DecisionSource,
  PresentationTypeCode,
  ReviewAssignmentStatus,
  SubmissionStatus,
  type ReviewRecommendation,
  type SlotResponse,
} from "@/app/generated/prisma/client";
import {
  computeStandardDeviation,
} from "@/lib/services/reviews/stats";
import {
  BOARD_STATUSES,
  isPendingRelease,
} from "./state-machine";
import { readDecisionSettings, registrationDueAt } from "./settings";
import type { DecisionBoardQuery } from "@/lib/validators/decisions";

export interface DecisionBoardRow {
  id: string;
  refNo: string | null;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  submissionTypeId: string;
  submissionTypeName: string;
  preferredPresentationType: string | null;
  status: SubmissionStatus;
  submitter: {
    id: string;
    email: string;
    fullName: string | null;
  };
  presentingAuthor: {
    name: string;
    email: string;
  } | null;
  scoreStats: {
    completedReviews: number;
    assignedReviews: number;
    weightedAverageScore: number;
    standardDeviation: number;
    scoreGap: number;
    isDisputed: boolean;
    disputeReason: string | null;
  };
  reviews: Array<{
    reviewerId: string;
    reviewerName: string | null;
    weightedScore: number;
    recommendation: ReviewRecommendation | null;
    commentAuthor: string | null;
    commentCommittee: string | null;
    submittedAt: string | null;
  }>;
  chairRecommendation: DecisionOutcome | null;
  chairRecommendedAt: string | null;
  decision: DecisionOutcome | null;
  decisionSource: DecisionSource | null;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
  presentationType: PresentationTypeCode | null;
  isPendingRelease: boolean;
  decisionReleasedAt: string | null;
  reviewsReleased: boolean;
  revisionDueAt: string | null;
  slotResponse: SlotResponse | null;
  slotRespondedAt: string | null;
  isUnregistered: boolean;
  registrationFlaggedAt: string | null;
}

export interface DecisionBoardSummary {
  total: number;
  decidable: number;
  pendingRelease: number;
  acceptedOral: number;
  acceptedPoster: number;
  rejected: number;
  revisionsRequested: number;
  waitlisted: number;
  disputed: number;
  declined: number;
  unregistered: number;
}

export async function getDecisionBoard(
  orgId: string,
  eventId: string,
  query: DecisionBoardQuery = {},
  allowedCategoryIds: string[] | null = null,
): Promise<{
  rows: DecisionBoardRow[];
  summary: DecisionBoardSummary;
  settings: ReturnType<typeof readDecisionSettings>;
}> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { settings: true, registrationCloseAt: true },
  });
  if (!event) throw new Error("Event not found");

  const settings = readDecisionSettings(event);
  const regDueDate = registrationDueAt(event);
  const now = new Date();

  // Load criteria weights
  const rubricCriteria = await prisma.rubricCriterion.findMany({
    where: { eventId },
    select: { id: true, name: true, weight: true, scaleMax: true, scaleMin: true },
  });

  const criteriaMap = new Map(rubricCriteria.map((c) => [c.id, c]));

  // Base query
  const where: Record<string, unknown> = {
    orgId,
    eventId,
    deletedAt: null,
    status: { in: [...BOARD_STATUSES] },
  };

  if (allowedCategoryIds !== null) {
    where.categoryId = { in: allowedCategoryIds };
  } else if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.submissionTypeId) {
    where.submissionTypeId = query.submissionTypeId;
  }

  if (query.status) {
    where.status = query.status as SubmissionStatus;
  }

  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { title: { contains: s, mode: "insensitive" } },
      { refNo: { contains: s, mode: "insensitive" } },
    ];
  }

  const submissions = await prisma.submission.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } },
      submissionType: { select: { id: true, name: true } },
      submitter: { select: { id: true, fullName: true, email: true } },
      authors: {
        where: { isPresenting: true },
        select: { surname: true, initials: true, email: true },
        take: 1,
      },
      decidedBy: { select: { id: true, fullName: true, email: true } },
      reviewAssignments: {
        where: { status: { not: ReviewAssignmentStatus.CONFLICT } },
        include: {
          reviewer: { select: { id: true, fullName: true, email: true } },
          review: {
            include: {
              scores: true,
            },
          },
        },
      },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });

  let acceptedOral = 0;
  let acceptedPoster = 0;
  let rejected = 0;
  let revisionsRequested = 0;
  let waitlisted = 0;
  let disputed = 0;
  let declined = 0;
  let unregistered = 0;
  let pendingRelease = 0;
  let decidable = 0;

  const threshold = settings.disagreementThreshold;

  const rows: DecisionBoardRow[] = submissions.map((s) => {
    // Process reviews and calculate weighted scores
    const completedReviews: DecisionBoardRow["reviews"] = [];
    const scoresForStdDev: number[] = [];

    for (const assignment of s.reviewAssignments) {
      if (
        assignment.status === ReviewAssignmentStatus.COMPLETED &&
        assignment.review &&
        !assignment.review.isDraft
      ) {
        const review = assignment.review;
        let sumWeightedScores = 0;
        let sumWeights = 0;

        for (const sc of review.scores) {
          const crit = criteriaMap.get(sc.criterionId);
          if (crit) {
            sumWeightedScores += sc.score * crit.weight;
            sumWeights += crit.weight;
          }
        }

        const weightedScore =
          sumWeights > 0 ? Math.round((sumWeightedScores / sumWeights) * 100) / 100 : 0;

        scoresForStdDev.push(weightedScore);

        completedReviews.push({
          reviewerId: assignment.reviewer.id,
          reviewerName: assignment.reviewer.fullName || assignment.reviewer.email,
          weightedScore,
          recommendation: review.recommendation,
          commentAuthor: review.commentAuthor,
          commentCommittee: review.commentCommittee,
          submittedAt: review.submittedAt ? review.submittedAt.toISOString() : null,
        });
      }
    }

    const completedCount = completedReviews.length;
    const avgScore =
      completedCount > 0
        ? Math.round(
            (scoresForStdDev.reduce((a, b) => a + b, 0) / completedCount) * 100,
          ) / 100
        : 0;

    const stdDev = computeStandardDeviation(scoresForStdDev);

    let scoreGap = 0;
    if (scoresForStdDev.length >= 2) {
      const min = Math.min(...scoresForStdDev);
      const max = Math.max(...scoresForStdDev);
      scoreGap = Math.round((max - min) * 100) / 100;
    }

    const isDispute = scoreGap >= threshold;
    const disputeReason = isDispute
      ? `Reviewers differ by ${scoreGap.toFixed(1)} points (threshold is ${threshold})`
      : null;

    if (isDispute) disputed++;

    // Submitter / presenter details
    const presenter = s.authors[0];
    const presenterName = presenter
      ? `${presenter.initials} ${presenter.surname}`.trim()
      : s.submitter.fullName || s.submitter.email;

    const presenterEmail = presenter ? presenter.email : s.submitter.email;

    // Release and decision status
    const pending = isPendingRelease(s);
    if (pending) pendingRelease++;

    if (
      s.status === SubmissionStatus.SUBMITTED ||
      s.status === SubmissionStatus.UNDER_REVIEW ||
      s.status === SubmissionStatus.WAITLISTED
    ) {
      decidable++;
    }

    // Tally based on final decision or status
    const outcome = s.decision;
    if (outcome === DecisionOutcome.ACCEPT_ORAL) acceptedOral++;
    else if (outcome === DecisionOutcome.ACCEPT_POSTER) acceptedPoster++;
    else if (outcome === DecisionOutcome.REJECT) rejected++;
    else if (outcome === DecisionOutcome.REVISIONS_REQUESTED) revisionsRequested++;
    else if (outcome === DecisionOutcome.WAITLIST) waitlisted++;

    if (s.slotResponse === "DECLINED") declined++;

    // Unregistered check: accepted or confirmed, past registration deadline, and not yet confirmed
    const isPastReg = regDueDate ? now > regDueDate : false;
    const isUnreg =
      (s.status === SubmissionStatus.ACCEPTED || s.registrationFlaggedAt != null) &&
      (isPastReg || s.registrationFlaggedAt != null);

    if (isUnreg) unregistered++;

    return {
      id: s.id,
      refNo: s.refNo,
      title: s.title,
      categoryId: s.categoryId,
      categoryName: s.category?.name ?? null,
      submissionTypeId: s.submissionTypeId,
      submissionTypeName: s.submissionType.name,
      preferredPresentationType: s.preferredPresentationType,
      status: s.status,
      submitter: {
        id: s.submitter.id,
        email: s.submitter.email,
        fullName: s.submitter.fullName,
      },
      presentingAuthor: {
        name: presenterName,
        email: presenterEmail,
      },
      scoreStats: {
        completedReviews: completedCount,
        assignedReviews: s.reviewAssignments.length,
        weightedAverageScore: avgScore,
        standardDeviation: stdDev,
        scoreGap,
        isDisputed: isDispute,
        disputeReason,
      },
      reviews: completedReviews,
      chairRecommendation: s.chairRecommendation,
      chairRecommendedAt: s.chairRecommendedAt ? s.chairRecommendedAt.toISOString() : null,
      decision: s.decision,
      decisionSource: s.decisionSource,
      decisionNote: s.decisionNote,
      decidedAt: s.decidedAt ? s.decidedAt.toISOString() : null,
      decidedBy: s.decidedBy
        ? {
            id: s.decidedBy.id,
            fullName: s.decidedBy.fullName,
            email: s.decidedBy.email,
          }
        : null,
      presentationType: s.presentationType,
      isPendingRelease: pending,
      decisionReleasedAt: s.decisionReleasedAt ? s.decisionReleasedAt.toISOString() : null,
      reviewsReleased: s.reviewsReleased,
      revisionDueAt: s.revisionDueAt ? s.revisionDueAt.toISOString() : null,
      slotResponse: s.slotResponse,
      slotRespondedAt: s.slotRespondedAt ? s.slotRespondedAt.toISOString() : null,
      isUnregistered: isUnreg,
      registrationFlaggedAt: s.registrationFlaggedAt
        ? s.registrationFlaggedAt.toISOString()
        : null,
    };
  });

  // Filter in memory for score / views if specified
  let filtered = rows;

  if (query.minScore != null) {
    filtered = filtered.filter((r) => r.scoreStats.weightedAverageScore >= query.minScore!);
  }
  if (query.maxScore != null) {
    filtered = filtered.filter((r) => r.scoreStats.weightedAverageScore <= query.maxScore!);
  }
  if (query.disputedOnly) {
    filtered = filtered.filter((r) => r.scoreStats.isDisputed);
  }
  if (query.decision) {
    if (query.decision === "NONE") {
      filtered = filtered.filter((r) => r.decision === null);
    } else {
      filtered = filtered.filter((r) => r.decision === query.decision);
    }
  }

  if (query.view) {
    if (query.view === "pending_release") {
      filtered = filtered.filter((r) => r.isPendingRelease);
    } else if (query.view === "unregistered") {
      filtered = filtered.filter((r) => r.isUnregistered);
    } else if (query.view === "declined") {
      filtered = filtered.filter((r) => r.slotResponse === "DECLINED");
    }
  }

  // Rank by weighted average score descending by default
  filtered.sort((a, b) => {
    if (b.scoreStats.weightedAverageScore !== a.scoreStats.weightedAverageScore) {
      return b.scoreStats.weightedAverageScore - a.scoreStats.weightedAverageScore;
    }
    // tie breaker: review count descending, then refNo
    if (b.scoreStats.completedReviews !== a.scoreStats.completedReviews) {
      return b.scoreStats.completedReviews - a.scoreStats.completedReviews;
    }
    return (a.refNo || "").localeCompare(b.refNo || "");
  });

  return {
    rows: filtered,
    summary: {
      total: submissions.length,
      decidable,
      pendingRelease,
      acceptedOral,
      acceptedPoster,
      rejected,
      revisionsRequested,
      waitlisted,
      disputed,
      declined,
      unregistered,
    },
    settings,
  };
}

