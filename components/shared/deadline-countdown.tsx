"use client";

import { CalendarClock } from "lucide-react";
import { formatLongDateTime } from "@/lib/dates";
import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils";

type Urgency = "upcoming" | "soon" | "urgent" | "passed";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function describe(msLeft: number): { text: string; urgency: Urgency } {
  if (msLeft <= 0) return { text: "Closed", urgency: "passed" };
  if (msLeft < HOUR) {
    const m = Math.max(1, Math.ceil(msLeft / MINUTE));
    return { text: `${m} minute${m === 1 ? "" : "s"} left`, urgency: "urgent" };
  }
  if (msLeft < DAY) {
    const h = Math.floor(msLeft / HOUR);
    return { text: `${h} hour${h === 1 ? "" : "s"} left`, urgency: "urgent" };
  }
  const d = Math.floor(msLeft / DAY);
  return {
    text: `${d} day${d === 1 ? "" : "s"} left`,
    urgency: d <= 7 ? "soon" : "upcoming",
  };
}

const TONE: Record<Urgency, string> = {
  upcoming: "border-border bg-background text-foreground",
  soon: "border-warning/30 bg-warning-tint text-warning-foreground",
  urgent: "border-danger/30 bg-danger-tint text-danger-foreground",
  passed: "border-border bg-muted text-muted-foreground",
};

/**
 * "Submissions close · 4 days left · 17 December 2026, 11:59 pm".
 * The absolute date (Asia/Colombo) is always shown; the relative part appears
 * after hydration and refreshes every 30 s. Amber within 7 days, red within 24 h.
 */
export function DeadlineCountdown({
  label,
  deadline,
  className,
}: {
  label: string;
  deadline: Date | string;
  className?: string;
}) {
  const now = useNow();
  const due = typeof deadline === "string" ? new Date(deadline) : deadline;
  const state = now ? describe(due.getTime() - now.getTime()) : null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3",
        TONE[state?.urgency ?? "upcoming"],
        className,
      )}
    >
      <CalendarClock className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm">
          {label}
          {state ? (
            <>
              {" · "}
              <span className="font-semibold">{state.text}</span>
            </>
          ) : null}
        </p>
        <p className="text-base font-medium">
          <time dateTime={due.toISOString()}>{formatLongDateTime(due)}</time>
        </p>
      </div>
    </div>
  );
}
