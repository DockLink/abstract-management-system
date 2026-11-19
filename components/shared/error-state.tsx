import type { ReactNode } from "react";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Something failed to load. Say what failed and how to fix it — never
 * apologise, never be vague. Show it once (not as a toast as well).
 */
export function ErrorState({
  title = "This page didn't load",
  description = "Check your connection and try again.",
  onRetry,
  retrying = false,
  retryLabel = "Try again",
  action,
  compact = false,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  /** Secondary action, e.g. a "Back to event" link button. */
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-danger/25 bg-danger-tint/50 text-center",
        compact ? "px-4 py-8" : "px-6 py-12",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-danger-tint text-danger-foreground">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-[45ch] text-base text-muted-foreground">
          {description}
        </p>
      ) : null}
      {onRetry || action ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {onRetry ? (
            <Button onClick={onRetry} disabled={retrying}>
              {retrying ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <RotateCw data-icon="inline-start" />
              )}
              {retrying ? "Trying again…" : retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
