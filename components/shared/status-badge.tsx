import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EventLifecycleStatus } from "@/lib/events/status";

export type StatusKey =
  | EventLifecycleStatus
  | "pending"
  | "confirmed"
  | "member"
  | "rejected"
  | "accepted"
  | "waitlisted"
  | "submitted"
  | "under_review"
  | "info"
  | "warning"
  | "success"
  | "destructive";

const STATUS_MAP: Record<
  StatusKey,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "border-transparent bg-info-tint text-info-foreground",
  },
  open: {
    label: "Open for submissions",
    className: "border-transparent bg-success-tint text-success-foreground",
  },
  closed: {
    label: "Closed",
    className: "border-transparent bg-destructive-tint text-destructive",
  },
  pending: {
    label: "Pending",
    className: "border-transparent bg-warning-tint text-warning-foreground",
  },
  confirmed: {
    label: "Confirmed",
    className: "border-transparent bg-success-tint text-success-foreground",
  },
  member: {
    label: "Member",
    className: "border-transparent bg-success-tint text-success-foreground",
  },
  rejected: {
    label: "Rejected",
    className: "border-transparent bg-destructive-tint text-destructive",
  },
  accepted: {
    label: "Accepted",
    className: "border-transparent bg-success-tint text-success-foreground",
  },
  waitlisted: {
    label: "Waitlisted",
    className: "border-transparent bg-warning-tint text-warning-foreground",
  },
  submitted: {
    label: "Submitted",
    className: "border-transparent bg-info-tint text-info-foreground",
  },
  under_review: {
    label: "Under review",
    className: "border-transparent bg-info-tint text-info-foreground",
  },
  info: {
    label: "Info",
    className: "border-transparent bg-info-tint text-info-foreground",
  },
  warning: {
    label: "Warning",
    className: "border-transparent bg-warning-tint text-warning-foreground",
  },
  success: {
    label: "Success",
    className: "border-transparent bg-success-tint text-success-foreground",
  },
  destructive: {
    label: "Error",
    className: "border-transparent bg-destructive-tint text-destructive",
  },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: StatusKey;
  label?: string;
  className?: string;
}) {
  const mapped = STATUS_MAP[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        mapped.className,
        className,
      )}
    >
      {label ?? mapped.label}
    </Badge>
  );
}
