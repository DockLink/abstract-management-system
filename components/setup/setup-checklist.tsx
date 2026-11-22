import Link from "next/link";
import { Check, ChevronRight, PartyPopper } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ChecklistStep = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
  /** Rough time to complete — helps admins plan the "under an hour" setup. */
  minutes: number;
};

/**
 * The eight setup checks from the dashboard API's configCompleteness, in the
 * order that gets an event ready fastest. Presentation only: completion is
 * whatever the API reports.
 */
export function buildSetupSteps(
  done: Record<string, boolean>,
  base: string,
): ChecklistStep[] {
  return [
    { id: "hasKeyDates", label: "Set the key dates", description: "When submissions open and close, and when reviews and decisions are due.", href: `${base}/setup?tab=dates`, minutes: 5 },
    { id: "hasCategories", label: "Add tracks and chairs", description: "The categories authors submit to, each with a track chair.", href: `${base}/categories`, minutes: 10 },
    { id: "hasSubmissionTypes", label: "Set up submission types", description: "Original research, case report and so on — each with its word limit and form.", href: `${base}/submission-types`, minutes: 15 },
    { id: "hasPresentationTypes", label: "Check presentation types", description: "Oral, poster, or either — used when decisions are made.", href: `${base}/submission-types#presentation-types`, minutes: 2 },
    { id: "hasEligibility", label: "Choose eligibility rules", description: "Abstracts per author, member authors, and registration for presenters.", href: `${base}/eligibility`, minutes: 5 },
    { id: "hasGuidelines", label: "Publish author guidelines", description: "Rich text on the public page, a PDF, or both.", href: `${base}/setup?tab=public`, minutes: 10 },
    { id: "hasBranding", label: "Add the event logo", description: "Shown on the public page, emails and certificates.", href: `${base}/setup?tab=basics`, minutes: 3 },
    { id: "hasMembers", label: "Import the member list", description: "A CSV of college members, used to check eligibility and pricing.", href: `${base}/members`, minutes: 5 },
  ].map((s) => ({ ...s, done: !!done[s.id] }));
}

export function SetupChecklist({
  steps,
  compact = false,
}: {
  steps: ChecklistStep[];
  /** Dashboard variant: progress + next step only. */
  compact?: boolean;
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const next = steps.find((s) => !s.done);
  const minutesLeft = steps.filter((s) => !s.done).reduce((n, s) => n + s.minutes, 0);
  const pct = Math.round((doneCount / total) * 100);

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-heading text-2xl font-semibold">
          {doneCount === total ? "Setup complete" : `${doneCount} of ${total} steps done`}
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          {doneCount === total
            ? "Everything authors need is in place. Check the public page before you share it."
            : `About ${minutesLeft} minutes of setup left.`}
        </p>
      </div>
      <span className="text-sm font-medium text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );

  if (compact) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 md:p-5">
        {header}
        <Progress value={pct} className="mt-4" aria-label={`Setup ${pct}% complete`} />
        {next ? (
          <Link
            href={next.href}
            className="-mx-2 mt-3 flex min-h-control items-center gap-2 rounded-md px-2 text-base font-medium text-brand-ink hover:bg-muted"
          >
            <span className="flex-1">Next: {next.label}</span>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby="setup-progress" className="rounded-lg border border-border bg-card">
      <div className="p-4 md:p-6">
        <div id="setup-progress">{header}</div>
        <Progress value={pct} className="mt-4" aria-label={`Setup ${pct}% complete`} />
      </div>
      {doneCount === total ? (
        <div className="flex items-center gap-3 border-t border-border bg-success-tint px-4 py-3 text-base text-success-foreground md:px-6">
          <PartyPopper className="size-5 shrink-0" aria-hidden />
          Ready to open submissions on the dates you set.
        </div>
      ) : null}
      <ol className="border-t border-border">
        {steps.map((s, i) => {
          const isNext = s === next;
          return (
            <li key={s.id} className="border-b border-border last:border-0">
              <Link
                href={s.href}
                className={cn(
                  "flex min-h-16 items-start gap-4 px-4 py-4 hover:bg-muted/50 md:px-6",
                  isNext && "bg-primary-tint/50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums",
                    s.done ? "border-primary bg-primary text-primary-foreground" : isNext ? "border-primary text-brand-ink" : "border-input text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {s.done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-base font-semibold", s.done && "text-muted-foreground")}>
                    {s.label}
                    <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
                  </span>
                  <span className="block text-sm text-muted-foreground">{s.description}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 self-center text-sm text-muted-foreground">
                  {s.done ? "Done" : isNext ? <span className="font-semibold text-brand-ink">Start</span> : `${s.minutes} min`}
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
