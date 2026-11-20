import { prisma } from "@/lib/db/prisma";
import {
  DecisionOutcome,
  DecisionSource,
  PresentationTypeCode,
  SubmissionStatus,
} from "@/app/generated/prisma/client";
import { readDecisionSettings } from "./settings";
import { getDecisionBoard } from "./board";

export interface CutoffChange {
  submissionId: string;
  refNo: string | null;
  title: string;
  categoryName: string | null;
  score: number;
  reviewCount: number;
  currentDecision: DecisionOutcome | null;
  provisionalDecision: DecisionOutcome | null;
  presentationType: PresentationTypeCode | null;
  isDisputed: boolean;
  skipReason: string | null;
}

export interface CutoffsResult {
  oralCutoff: number | null;
  posterCutoff: number | null;
  belowCutoff: "NONE" | "WAITLIST" | "REJECT";
  minReviews: number;
  skipDisputed: boolean;
  summary: {
    totalEvaluated: number;
    oralAssigned: number;
    posterAssigned: number;
    waitlistAssigned: number;
    rejectAssigned: number;
    skippedReviews: number;
    skippedDisputed: number;
    unaffected: number;
  };
  changes: CutoffChange[];
}

export async function previewOrApplyCutoffs(
  orgId: string,
  eventId: string,
  mode: "preview" | "apply",
  categoryId?: string,
  actorId?: string,
): Promise<CutoffsResult> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { settings: true },
  });
  if (!event) throw new Error("Event not found");

  const settings = readDecisionSettings(event);
  const { oralMinScore, posterMinScore, belowCutoff, minCompletedReviews, skipDisputed } = settings;

  const board = await getDecisionBoard(
    orgId,
    eventId,
    { categoryId },
    categoryId ? [categoryId] : null,
  );

  let oralAssigned = 0;
  let posterAssigned = 0;
  let waitlistAssigned = 0;
  let rejectAssigned = 0;
  let skippedReviews = 0;
  let skippedDisputed = 0;
  let unaffected = 0;

  const changes: CutoffChange[] = [];
  const toUpdate: Array<{
    id: string;
    decision: DecisionOutcome;
    presentationType: PresentationTypeCode | null;
  }> = [];

  for (const row of board.rows) {
    // Only apply cutoffs to decidable statuses (submitted, under_review, waitlisted)
    if (
      row.status !== SubmissionStatus.SUBMITTED &&
      row.status !== SubmissionStatus.UNDER_REVIEW &&
      row.status !== SubmissionStatus.WAITLISTED
    ) {
      unaffected++;
      continue;
    }

    if (row.scoreStats.completedReviews < minCompletedReviews) {
      skippedReviews++;
      changes.push({
        submissionId: row.id,
        refNo: row.refNo,
        title: row.title,
        categoryName: row.categoryName,
        score: row.scoreStats.weightedAverageScore,
        reviewCount: row.scoreStats.completedReviews,
        currentDecision: row.decision,
        provisionalDecision: null,
        presentationType: null,
        isDisputed: row.scoreStats.isDisputed,
        skipReason: `Fewer than ${minCompletedReviews} reviews (${row.scoreStats.completedReviews})`,
      });
      continue;
    }

    if (skipDisputed && row.scoreStats.isDisputed) {
      skippedDisputed++;
      changes.push({
        submissionId: row.id,
        refNo: row.refNo,
        title: row.title,
        categoryName: row.categoryName,
        score: row.scoreStats.weightedAverageScore,
        reviewCount: row.scoreStats.completedReviews,
        currentDecision: row.decision,
        provisionalDecision: null,
        presentationType: null,
        isDisputed: true,
        skipReason: "Reviewers disagreed by more than threshold",
      });
      continue;
    }

    let provDecision: DecisionOutcome | null = null;
    let provPresType: PresentationTypeCode | null = null;

    const score = row.scoreStats.weightedAverageScore;

    if (oralMinScore != null && score >= oralMinScore) {
      provDecision = DecisionOutcome.ACCEPT_ORAL;
      provPresType = PresentationTypeCode.ORAL;
      oralAssigned++;
    } else if (posterMinScore != null && score >= posterMinScore) {
      provDecision = DecisionOutcome.ACCEPT_POSTER;
      provPresType = PresentationTypeCode.POSTER;
      posterAssigned++;
    } else if (belowCutoff === "WAITLIST") {
      provDecision = DecisionOutcome.WAITLIST;
      waitlistAssigned++;
    } else if (belowCutoff === "REJECT") {
      provDecision = DecisionOutcome.REJECT;
      rejectAssigned++;
    } else {
      unaffected++;
    }

    if (provDecision) {
      changes.push({
        submissionId: row.id,
        refNo: row.refNo,
        title: row.title,
        categoryName: row.categoryName,
        score,
        reviewCount: row.scoreStats.completedReviews,
        currentDecision: row.decision,
        provisionalDecision: provDecision,
        presentationType: provPresType,
        isDisputed: row.scoreStats.isDisputed,
        skipReason: null,
      });

      toUpdate.push({
        id: row.id,
        decision: provDecision,
        presentationType: provPresType,
      });
    }
  }

  if (mode === "apply" && toUpdate.length > 0) {
    const now = new Date();
    await prisma.$transaction(
      toUpdate.map((u) =>
        prisma.submission.update({
          where: { id: u.id },
          data: {
            decision: u.decision,
            presentationType: u.presentationType,
            decisionSource: DecisionSource.CUTOFF,
            decidedAt: now,
            decidedById: actorId ?? null,
          },
        }),
      ),
    );
  }

  return {
    oralCutoff: oralMinScore,
    posterCutoff: posterMinScore,
    belowCutoff,
    minReviews: minCompletedReviews,
    skipDisputed,
    summary: {
      totalEvaluated: board.rows.length,
      oralAssigned,
      posterAssigned,
      waitlistAssigned,
      rejectAssigned,
      skippedReviews,
      skippedDisputed,
      unaffected,
    },
    changes,
  };
}

