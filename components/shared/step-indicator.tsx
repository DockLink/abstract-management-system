"use client";

import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "complete" | "current" | "upcoming" | "error";

export type Step = {
  label: string;
  description?: string;
  /** Explicit state. Defaults to complete/current/upcoming from `current`. */
  state?: StepState;
};

/**
 * Progress through a multi-step form (the abstract wizard).
 *
 * - Phones: "Step 2 of 5 · Authors" with a progress bar — no cramped dots.
 * - md+: the full list with labels.
 * - A step is only clickable when `onStepClick` is given AND the step is
 *   complete, errored or current — upcoming steps can't be skipped to.
 *   Completion must come from validation, not from having visited a step.
 */
export function StepIndicator({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: Step[];
  /** 0-based index of the current step. */
  current: number;
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  const stateOf = (i: number): StepState =>
    steps[i].state ?? (i < current ? "complete" : i === current ? "current" : "upcoming");
  const pct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 100;
  const needsAttention = steps.filter((_, i) => stateOf(i) === "error");

  return (
    <nav aria-label="Form progress" className={className}>
      {/* Phone */}
      <div className="md:hidden">
        <p className="text-sm text-muted-foreground">
          Step {current + 1} of {steps.length}
        </p>
        <p className="text-lg font-semibold text-foreground">{steps[current]?.label}</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
        {needsAttention.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-danger-foreground">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            Needs attention:
            {needsAttention.map((s) => {
              const i = steps.indexOf(s);
              return onStepClick ? (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => onStepClick(i)}
                  className="-my-2 inline-flex min-h-control items-center rounded-md px-1 underline underline-offset-4"
                >
                  {s.label}
                </button>
              ) : (
                <span key={s.label}>{s.label}</span>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Tablet / desktop */}
      <ol className="hidden items-start gap-2 md:flex">
        {steps.map((step, i) => {
          const state = stateOf(i);
          const clickable = !!onStepClick && state !== "upcoming";
          const marker = (
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums",
                state === "complete" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-primary bg-background text-brand-ink",
                state === "upcoming" && "border-border bg-background text-muted-foreground",
                state === "error" && "border-danger bg-danger-tint text-danger-foreground",
              )}
            >
              {state === "complete" ? (
                <Check className="size-4" aria-hidden />
              ) : state === "error" ? (
                <AlertCircle className="size-4" aria-hidden />
              ) : (
                i + 1
              )}
            </span>
          );
          const text = (
            <span className="min-w-0 text-left">
              <span
                className={cn(
                  "block text-sm font-medium leading-tight",
                  state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.label}
              </span>
              {step.description ? (
                <span className="block text-xs text-muted-foreground">{step.description}</span>
              ) : null}
              <span className="sr-only">
                {state === "complete" ? " (complete)" : state === "error" ? " (needs attention)" : state === "upcoming" ? " (not started)" : ""}
              </span>
            </span>
          );
          return (
            <li key={step.label} className="flex min-w-0 flex-1 items-start gap-2">
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(i)}
                  aria-current={state === "current" ? "step" : undefined}
                  className="flex min-h-control min-w-0 items-start gap-2.5 rounded-md p-1 hover:bg-muted"
                >
                  {marker}
                  {text}
                </button>
              ) : (
                <div
                  aria-current={state === "current" ? "step" : undefined}
                  className="flex min-h-control min-w-0 items-start gap-2.5 p-1"
                >
                  {marker}
                  {text}
                </div>
              )}
              {i < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mt-5 hidden h-0.5 min-w-4 flex-1 rounded-full lg:block",
                    i < current ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
