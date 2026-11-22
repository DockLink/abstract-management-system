import type { Event } from "@/app/generated/prisma/client";

const COLOMBO_TZ = "Asia/Colombo";

/** Current instant — key dates are stored UTC; comparison is absolute. */
export function nowUtc() {
  return new Date();
}

export type PortalState = {
  timezone: typeof COLOMBO_TZ;
  now: string;
  submissionOpen: boolean;
  reviewOpen: boolean;
  earlyBirdActive: boolean;
  registrationOpen: boolean;
  canSubmit: boolean;
};

export function derivePortalState(
  event: Pick<
    Event,
    | "submissionOpenAt"
    | "submissionCloseAt"
    | "reviewDeadlineAt"
    | "earlyBirdEndAt"
    | "registrationCloseAt"
  >,
  now: Date = nowUtc(),
): PortalState {
  const after = (d: Date | null) => (d ? now >= d : false);
  const before = (d: Date | null) => (d ? now <= d : true);

  // If open date missing but close exists, treat as open until close
  const submissionOpen =
    event.submissionOpenAt || event.submissionCloseAt
      ? (event.submissionOpenAt ? after(event.submissionOpenAt) : true) &&
        before(event.submissionCloseAt)
      : false;

  const reviewOpen = event.reviewDeadlineAt
    ? now <= event.reviewDeadlineAt
    : false;
  const earlyBirdActive = event.earlyBirdEndAt
    ? now <= event.earlyBirdEndAt
    : false;
  const registrationOpen = event.registrationCloseAt
    ? now <= event.registrationCloseAt
    : false;

  return {
    timezone: COLOMBO_TZ,
    now: now.toISOString(),
    submissionOpen,
    reviewOpen,
    earlyBirdActive,
    registrationOpen,
    canSubmit: submissionOpen,
  };
}
