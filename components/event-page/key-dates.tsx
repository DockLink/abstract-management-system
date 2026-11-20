import { Check } from "lucide-react";
import { formatLongDateTime, formatRelativeToNow } from "@/lib/dates";
import type { KeyDates } from "@/lib/types/api";
import { cn } from "@/lib/utils";

const LABELS: Array<{ key: keyof KeyDates; label: string }> = [
  { key: "submissionOpenAt", label: "Submissions open" },
  { key: "submissionCloseAt", label: "Submission deadline" },
  { key: "reviewDeadlineAt", label: "Reviews complete" },
  { key: "notificationAt", label: "Decisions announced" },
  { key: "earlyBirdEndAt", label: "Early-bird registration ends" },
  { key: "registrationCloseAt", label: "Registration closes" },
];

type State = "past" | "next" | "upcoming";

/**
 * Key dates as a vertical timeline (EVT-03). Each date is past, next (the
 * one coming up) or upcoming, judged against the server's clock in
 * Asia/Colombo, so the page renders the same for everyone.
 */
export function KeyDates({ keyDates, now }: { keyDates: KeyDates; now: string }) {
  const nowMs = new Date(now).getTime();
  const points = LABELS.flatMap(({ key, label }) => {
    const value = keyDates[key];
    return value ? [{ key, label, value, time: new Date(value).getTime() }] : [];
  }).sort((a, b) => a.time - b.time);

  if (points.length === 0) {
    return <p className="text-base text-muted-foreground">Dates will be announced soon.</p>;
  }

  const nextIndex = points.findIndex((p) => p.time >= nowMs);
  const stateOf = (i: number): State =>
    points[i].time < nowMs ? "past" : i === nextIndex ? "next" : "upcoming";

  return (
    <ol className="relative">
      {points.map((p, i) => {
        const state = stateOf(i);
        const last = i === points.length - 1;
        return (
          <li key={p.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-7 bottom-0 left-[13px] w-0.5",
                  state === "past" ? "bg-muted-foreground/40" : "bg-border",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                state === "past" && "border-muted-foreground/40 bg-muted text-muted-foreground",
                state === "next" && "border-primary bg-primary text-primary-foreground ring-4 ring-primary-tint",
                state === "upcoming" && "border-input bg-background",
              )}
            >
              {state === "past" ? <Check className="size-4" /> : null}
              {state === "next" ? <span className="size-2 rounded-full bg-current" /> : null}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn("text-base font-medium", state === "past" && "text-muted-foreground")}>
                {p.label}
                <span className="sr-only">
                  {state === "past" ? " (passed)" : state === "next" ? " (next)" : " (upcoming)"}
                </span>
              </p>
              <p className={cn("text-sm", state === "past" ? "text-muted-foreground" : "text-foreground")}>
                <time dateTime={p.value}>{formatLongDateTime(p.value)}</time>
              </p>
              <p
                className={cn(
                  "text-sm",
                  state === "next" ? "font-semibold text-brand-ink" : "text-muted-foreground",
                )}
              >
                {state === "past" ? "Passed" : formatRelativeToNow(p.value, new Date(nowMs))}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The milestone worth a countdown right now, if any. */
export function countdownTarget(
  keyDates: KeyDates,
  portal: { submissionOpen: boolean; registrationOpen: boolean; now: string },
): { label: string; deadline: string } | null {
  const now = new Date(portal.now).getTime();
  if (portal.submissionOpen && keyDates.submissionCloseAt) {
    return { label: "Submissions close", deadline: keyDates.submissionCloseAt };
  }
  if (keyDates.submissionOpenAt && new Date(keyDates.submissionOpenAt).getTime() > now) {
    return { label: "Submissions open", deadline: keyDates.submissionOpenAt };
  }
  if (portal.registrationOpen && keyDates.registrationCloseAt) {
    return { label: "Registration closes", deadline: keyDates.registrationCloseAt };
  }
  return null;
}
