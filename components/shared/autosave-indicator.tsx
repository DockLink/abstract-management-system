import { AlertCircle, Check, CloudOff, Loader2 } from "lucide-react";
import { formatClockTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type AutosaveState = "idle" | "saving" | "saved" | "error" | "offline";

/**
 * Always-visible save status for auto-saving forms (abstract drafts, reviews).
 * Never hide it on mobile — it is how a reviewer between clinics knows their
 * work is safe. Announced politely to screen readers.
 */
export function AutosaveIndicator({
  state,
  savedAt,
  onRetry,
  className,
}: {
  state: AutosaveState;
  savedAt?: Date | string | null;
  onRetry?: () => void;
  className?: string;
}) {
  const time = formatClockTime(savedAt);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 text-sm",
        state === "error" ? "text-danger-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {state === "saving" ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Saving…
        </>
      ) : null}
      {state === "saved" ? (
        <>
          <Check className="size-4 text-success" aria-hidden />
          {time ? `Saved ${time}` : "Saved"}
        </>
      ) : null}
      {state === "idle" ? (
        time ? (
          <>
            <Check className="size-4" aria-hidden />
            Saved {time}
          </>
        ) : (
          "Not saved yet"
        )
      ) : null}
      {state === "offline" ? (
        <>
          <CloudOff className="size-4" aria-hidden />
          Offline — changes will save when you reconnect
        </>
      ) : null}
      {state === "error" ? (
        <>
          <AlertCircle className="size-4" aria-hidden />
          Couldn&apos;t save
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="-my-2 inline-flex min-h-control items-center rounded-md px-2 font-medium underline underline-offset-4 hover:text-foreground"
            >
              Retry
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
