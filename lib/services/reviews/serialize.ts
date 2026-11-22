import {
  type RubricCriterion,
  type ReviewAssignment,
  type Review,
  type ReviewScore,
  type User,
  type Submission,
  type SubmissionAuthor,
  type SubmissionAffiliation,
  type Event,
  BlindMode,
} from "@/app/generated/prisma/client";

export function serializeRubricCriterion(criterion: RubricCriterion) {
  return {
    id: criterion.id,
    orgId: criterion.orgId,
    eventId: criterion.eventId,
    name: criterion.name,
    description: criterion.description,
    scaleMin: criterion.scaleMin,
    scaleMax: criterion.scaleMax,
    weight: criterion.weight,
    sortOrder: criterion.sortOrder,
    createdAt: criterion.createdAt.toISOString(),
    updatedAt: criterion.updatedAt.toISOString(),
  };
}

export function serializeReviewScore(score: ReviewScore & { criterion?: RubricCriterion }) {
  return {
    id: score.id,
    reviewId: score.reviewId,
    criterionId: score.criterionId,
    score: score.score,
    createdAt: score.createdAt.toISOString(),
    updatedAt: score.updatedAt.toISOString(),
    ...(score.criterion ? { criterion: serializeRubricCriterion(score.criterion) } : {}),
  };
}

export function serializeReview(
  review: Review & {
    scores?: (ReviewScore & { criterion?: RubricCriterion })[];
  },
) {
  return {
    id: review.id,
    orgId: review.orgId,
    eventId: review.eventId,
    assignmentId: review.assignmentId,
    recommendation: review.recommendation,
    commentAuthor: review.commentAuthor,
    commentCommittee: review.commentCommittee,
    isDraft: review.isDraft,
    submittedAt: review.submittedAt ? review.submittedAt.toISOString() : null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    scores: (review.scores ?? []).map(serializeReviewScore),
  };
}

export function serializeReviewAssignment(
  assignment: ReviewAssignment & {
    reviewer?: Pick<User, "id" | "email" | "fullName" | "institution">;
    review?: (Review & { scores?: (ReviewScore & { criterion?: RubricCriterion })[] }) | null;
    submission?: Submission & {
      category?: { id: string; name: string } | null;
      submissionType?: { id: string; name: string } | null;
    };
  },
) {
  return {
    id: assignment.id,
    orgId: assignment.orgId,
    eventId: assignment.eventId,
    submissionId: assignment.submissionId,
    reviewerId: assignment.reviewerId,
    status: assignment.status,
    dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
    coiReason: assignment.coiReason,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
    ...(assignment.reviewer
      ? {
          reviewer: {
            id: assignment.reviewer.id,
            email: assignment.reviewer.email,
            fullName: assignment.reviewer.fullName,
            institution: assignment.reviewer.institution,
          },
        }
      : {}),
    ...(assignment.review !== undefined
      ? { review: assignment.review ? serializeReview(assignment.review) : null }
      : {}),
    ...(assignment.submission
      ? {
          submission: {
            id: assignment.submission.id,
            refNo: assignment.submission.refNo,
            title: assignment.submission.title,
            status: assignment.submission.status,
            category: assignment.submission.category
              ? {
                  id: assignment.submission.category.id,
                  name: assignment.submission.category.name,
                }
              : null,
            submissionType: assignment.submission.submissionType
              ? {
                  id: assignment.submission.submissionType.id,
                  name: assignment.submission.submissionType.name,
                }
              : null,
          },
        }
      : {}),
  };
}

/**
 * Serializes submission for a reviewer respecting Blind Mode (REV-03):
 * - DOUBLE blind: hides author names, emails, institutions, affiliations, uploaded supplementary files.
 * - SINGLE blind: reviewer sees authors/affiliations; reviewer identity is hidden from author.
 * - In ALL blind modes, ERC certificates are visible ONLY to admins, never to reviewers.
 */
export function serializeBlindSubmissionForReviewer(
  submission: Submission & {
    authors?: SubmissionAuthor[];
    affiliations?: SubmissionAffiliation[];
    category?: { id: string; name: string } | null;
    submissionType?: { id: string; name: string } | null;
  },
  event: Pick<Event, "blindMode">,
) {
  const isDoubleBlind = event.blindMode === BlindMode.DOUBLE;

  return {
    id: submission.id,
    refNo: submission.refNo,
    title: submission.title,
    abstractBody: submission.abstractBody,
    keywords: submission.keywords,
    wordCount: submission.wordCount,
    preferredPresentationType: submission.preferredPresentationType,
    category: submission.category
      ? { id: submission.category.id, name: submission.category.name }
      : null,
    submissionType: submission.submissionType
      ? { id: submission.submissionType.id, name: submission.submissionType.name }
      : null,
    submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
    blindMode: event.blindMode,

    // Authors and affiliations are omitted in DOUBLE blind mode
    authors: isDoubleBlind
      ? []
      : (submission.authors ?? []).map((a) => ({
          surname: a.surname,
          initials: a.initials,
          affiliationNos: a.affiliationNos,
          isPresenting: a.isPresenting,
          isCorresponding: a.isCorresponding,
          sortOrder: a.sortOrder,
        })),

    affiliations: isDoubleBlind
      ? []
      : (submission.affiliations ?? []).map((af) => ({
          number: af.number,
          text: af.text,
        })),

    // ERC files are NEVER exposed to reviewers (REV-03)
    ercStatus: null,
    ercInstitution: null,
    ercRefNo: null,
    ercFilePath: null,
  };
}

