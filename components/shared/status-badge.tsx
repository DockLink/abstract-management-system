import { cn } from "@/lib/utils";
import {
  STATUS_MAP,
  STATUS_TONE_CLASS,
  normalizeStatus,
  type StatusKey,
  type StatusTone,
} from "@/lib/status";

export type { StatusKey, StatusTone };

/**
 * The only way to show a status. Colour is never the sole signal: the label is
 * always present and the leading dot keeps chips distinguishable in greyscale.
 *
 *   <StatusBadge status="under_review" />
 *   <StatusBadge status={submission.status} />   // "UNDER_REVIEW" works too
 */
export function StatusBadge({
  status,
  label,
  size = "default",
  className,
}: {
  status: StatusKey | (string & {});
  label?: string;
  size?: "default" | "sm";
  className?: string;
}) {
  const key = normalizeStatus(status);
  const entry = key ? STATUS_MAP[key] : null;
  const tone: StatusTone = entry?.tone ?? "draft";

  return (
    <span
      data-slot="status-badge"
      data-status={key ?? status}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md font-medium whitespace-nowrap",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm",
        STATUS_TONE_CLASS[tone],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {label ?? entry?.label ?? status}
    </span>
  );
}
