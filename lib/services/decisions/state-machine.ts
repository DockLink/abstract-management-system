import {
  DecisionOutcome,
  PresentationTypeCode,
  SubmissionStatus,
} from "@/app/generated/prisma/client";

/**
 * Submission status state machine (requirements: Module 4 status flow).
 *
 *   DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED → CONFIRMED
 *                                   ↘ REJECTED
 *                                   ↘ WAITLISTED → ACCEPTED (slot frees)
 *                                   ↘ REVISIONS_REQUESTED → SUBMITTED / UNDER_REVIEW (same reviewers)
 *   DRAFT / SUBMITTED → WITHDRAWN (author, before a decision)
 *   ACCEPTED → WITHDRAWN (author declines the slot, DEC-08)
 */
const TRANSITIONS: Record<SubmissionStatus, readonly SubmissionStatus[]> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: [
    "UNDER_REVIEW",
    "ACCEPTED",
    "REJECTED",
    "WAITLISTED",
    "REVISIONS_REQUESTED",
    "WITHDRAWN",
  ],
  UNDER_REVIEW: ["ACCEPTED", "REJECTED", "WAITLISTED", "REVISIONS_REQUESTED", "WITHDRAWN"],
  REVISIONS_REQUESTED: ["SUBMITTED", "UNDER_REVIEW", "WITHDRAWN"],
  WAITLISTED: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: ["CONFIRMED", "WITHDRAWN"],
  CONFIRMED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Statuses on which a (new) decision can be recorded. */
export const DECIDABLE_STATUSES: readonly SubmissionStatus[] = [
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.UNDER_REVIEW,
  SubmissionStatus.WAITLISTED,
];

/** Statuses shown on the decision board (DEC-01). */
export const BOARD_STATUSES: readonly SubmissionStatus[] = [
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.UNDER_REVIEW,
  SubmissionStatus.REVISIONS_REQUESTED,
  SubmissionStatus.ACCEPTED,
  SubmissionStatus.REJECTED,
  SubmissionStatus.WAITLISTED,
  SubmissionStatus.CONFIRMED,
];

export function statusForDecision(decision: DecisionOutcome): SubmissionStatus {
  switch (decision) {
    case DecisionOutcome.ACCEPT_ORAL:
    case DecisionOutcome.ACCEPT_POSTER:
      return SubmissionStatus.ACCEPTED;
    case DecisionOutcome.REJECT:
      return SubmissionStatus.REJECTED;
    case DecisionOutcome.REVISIONS_REQUESTED:
      return SubmissionStatus.REVISIONS_REQUESTED;
    case DecisionOutcome.WAITLIST:
      return SubmissionStatus.WAITLISTED;
  }
}

export function presentationTypeForDecision(
  decision: DecisionOutcome,
): PresentationTypeCode | null {
  if (decision === DecisionOutcome.ACCEPT_ORAL) return PresentationTypeCode.ORAL;
  if (decision === DecisionOutcome.ACCEPT_POSTER) return PresentationTypeCode.POSTER;
  return null;
}

/**
 * A decision is waiting for release (DEC-04) when it would move the
 * submission to a different status and that move is allowed.
 */
export function isPendingRelease(s: {
  status: SubmissionStatus;
  decision: DecisionOutcome | null;
}): boolean {
  if (!s.decision) return false;
  const target = statusForDecision(s.decision);
  return target !== s.status && canTransition(s.status, target);
}

export const DECISION_LABEL: Record<DecisionOutcome, string> = {
  ACCEPT_ORAL: "Accept oral",
  ACCEPT_POSTER: "Accept poster",
  REJECT: "Reject",
  REVISIONS_REQUESTED: "Revisions requested",
  WAITLIST: "Waitlist",
};
