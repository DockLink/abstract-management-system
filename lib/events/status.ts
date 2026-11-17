import type { KeyDates } from "@/lib/types/api";
import { derivePortalState } from "@/lib/services/events/portal-state";

export type EventLifecycleStatus = "draft" | "open" | "closed";

export function getEventLifecycleStatus(
  keyDates: KeyDates,
  now: Date = new Date(),
): EventLifecycleStatus {
  const portal = derivePortalState(
    {
      submissionOpenAt: keyDates.submissionOpenAt
        ? new Date(keyDates.submissionOpenAt)
        : null,
      submissionCloseAt: keyDates.submissionCloseAt
        ? new Date(keyDates.submissionCloseAt)
        : null,
      reviewDeadlineAt: keyDates.reviewDeadlineAt
        ? new Date(keyDates.reviewDeadlineAt)
        : null,
      earlyBirdEndAt: keyDates.earlyBirdEndAt
        ? new Date(keyDates.earlyBirdEndAt)
        : null,
      registrationCloseAt: keyDates.registrationCloseAt
        ? new Date(keyDates.registrationCloseAt)
        : null,
    },
    now,
  );

  if (portal.submissionOpen) return "open";

  if (
    keyDates.submissionCloseAt &&
    new Date(keyDates.submissionCloseAt) < now
  ) {
    return "closed";
  }

  if (!keyDates.submissionOpenAt && !keyDates.submissionCloseAt) {
    return "draft";
  }

  // Open date in the future, or open missing with close in future after window ended logic
  if (
    keyDates.submissionOpenAt &&
    new Date(keyDates.submissionOpenAt) > now
  ) {
    return "draft";
  }

  return "closed";
}

export function eventStatusLabel(status: EventLifecycleStatus): string {
  switch (status) {
    case "open":
      return "Open for submissions";
    case "closed":
      return "Closed";
    default:
      return "Draft";
  }
}
