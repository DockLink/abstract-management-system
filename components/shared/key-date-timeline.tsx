import { formatCompactDay, formatEventDate } from "@/lib/dates";
import type { KeyDates } from "@/lib/types/api";
import { cn } from "@/lib/utils";

const KEYS: Array<{ key: keyof KeyDates; label: string }> = [
  { key: "submissionOpenAt", label: "Submission open" },
  { key: "submissionCloseAt", label: "Submission close" },
  { key: "reviewDeadlineAt", label: "Review deadline" },
  { key: "notificationAt", label: "Notification" },
  { key: "earlyBirdEndAt", label: "Early-bird end" },
  { key: "registrationCloseAt", label: "Registration close" },
];

export function KeyDateTimeline({
  keyDates,
  now = new Date(),
}: {
  keyDates: KeyDates;
  now?: Date;
}) {
  const points = KEYS.map((item) => ({
    ...item,
    value: keyDates[item.key],
    time: keyDates[item.key] ? new Date(keyDates[item.key] as string).getTime() : null,
  })).filter((p) => p.time !== null) as Array<{
    key: keyof KeyDates;
    label: string;
    value: string;
    time: number;
  }>;

  points.sort((a, b) => a.time - b.time);

  if (points.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No key dates configured yet.
      </p>
    );
  }

  const nowMs = now.getTime();

  return (
    <div className="overflow-x-auto">
      <div className="relative flex min-w-[640px] items-start gap-0 pt-6 pb-2">
        <div className="absolute top-9 right-4 left-4 h-px bg-border" />
        {points.map((point) => {
          const isPast = point.time < nowMs;
          const isNear =
            Math.abs(point.time - nowMs) < 1000 * 60 * 60 * 24 * 2;
          return (
            <div
              key={point.key}
              className="relative z-10 flex flex-1 flex-col items-center px-2 text-center"
            >
              <div
                className={cn(
                  "mb-3 size-3 rounded-full border-2 border-background",
                  isPast ? "bg-muted-foreground" : "bg-primary",
                  isNear && "ring-4 ring-primary-tint",
                )}
                title={formatEventDate(point.value)}
              />
              <p className="text-xs font-medium text-foreground">
                {point.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatCompactDay(point.value)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block size-2 rounded-full bg-primary" />
        Today marker is relative to Asia/Colombo deadlines
      </div>
    </div>
  );
}
