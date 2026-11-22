/**
 * Canonical status → label + tone map. Every status chip in the app goes
 * through <StatusBadge>, which reads this file. Colours live in globals.css
 * as --status-<tone> / --status-<tone>-foreground.
 *
 * Tone rules (ams-ui-standards):
 *   Draft grey · Submitted blue · Under review amber · Accepted green ·
 *   Rejected red · Confirmed emerald · Waitlisted purple · Revisions orange
 */

export type StatusTone =
  | "draft"
  | "submitted"
  | "review"
  | "accepted"
  | "rejected"
  | "confirmed"
  | "waitlisted"
  | "revisions";

export type StatusKey =
  // Submission lifecycle (SubmissionStatus enum)
  | "draft"
  | "submitted"
  | "under_review"
  | "revisions_requested"
  | "accepted"
  | "rejected"
  | "waitlisted"
  | "confirmed"
  | "withdrawn"
  // Review assignment (ReviewAssignmentStatus enum)
  | "pending"
  | "in_progress"
  | "completed"
  | "conflict"
  // Event lifecycle (lib/events/status.ts)
  | "open"
  | "closed"
  // Generic
  | "member"
  | "info"
  | "warning"
  | "success"
  | "destructive";

export const STATUS_MAP: Record<StatusKey, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "draft" },
  submitted: { label: "Submitted", tone: "submitted" },
  under_review: { label: "Under review", tone: "review" },
  revisions_requested: { label: "Revisions requested", tone: "revisions" },
  accepted: { label: "Accepted", tone: "accepted" },
  rejected: { label: "Rejected", tone: "rejected" },
  waitlisted: { label: "Waitlisted", tone: "waitlisted" },
  confirmed: { label: "Confirmed", tone: "confirmed" },
  withdrawn: { label: "Withdrawn", tone: "draft" },

  pending: { label: "Not started", tone: "draft" },
  in_progress: { label: "In progress", tone: "review" },
  completed: { label: "Completed", tone: "accepted" },
  conflict: { label: "Conflict declared", tone: "rejected" },

  open: { label: "Open for submissions", tone: "accepted" },
  closed: { label: "Closed", tone: "draft" },

  member: { label: "Member", tone: "confirmed" },
  info: { label: "Info", tone: "submitted" },
  warning: { label: "Warning", tone: "review" },
  success: { label: "Success", tone: "accepted" },
  destructive: { label: "Error", tone: "rejected" },
};

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  draft: "bg-status-draft text-status-draft-foreground",
  submitted: "bg-status-submitted text-status-submitted-foreground",
  review: "bg-status-review text-status-review-foreground",
  accepted: "bg-status-accepted text-status-accepted-foreground",
  rejected: "bg-status-rejected text-status-rejected-foreground",
  confirmed: "bg-status-confirmed text-status-confirmed-foreground",
  waitlisted: "bg-status-waitlisted text-status-waitlisted-foreground",
  revisions: "bg-status-revisions text-status-revisions-foreground",
};

/** Accepts enum values ("UNDER_REVIEW"), labels ("Under review") or keys. */
export function normalizeStatus(value: string): StatusKey | null {
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key in STATUS_MAP) return key as StatusKey;
  if (key === "revisions" || key === "revise") return "revisions_requested";
  if (key === "review") return "under_review";
  return null;
}
