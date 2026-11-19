import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * One figure with its label. Sentence-case label (no all-caps eyebrows),
 * tabular numerals, optional progress bar and drill-down link.
 */
export function StatCard({
  label,
  value,
  hint,
  progress,
  href,
  linkLabel,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** 0–100 */
  progress?: number;
  href?: string;
  linkLabel?: string;
  tone?: "default" | "warning" | "danger" | "success";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card p-4 md:p-5",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-3xl font-semibold tabular-nums",
          tone === "warning" && "text-warning-foreground",
          tone === "danger" && "text-danger-foreground",
          tone === "success" && "text-success-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      {progress !== undefined ? (
        <Progress
          value={Math.max(0, Math.min(100, progress))}
          className="mt-3"
          aria-label={`${label}: ${Math.round(progress)}%`}
        />
      ) : null}
      {href ? (
        <Link
          href={href}
          className="-mx-2 -mb-2 mt-auto inline-flex min-h-control items-center gap-1 self-start rounded-md px-2 pt-2 text-sm font-medium text-brand-ink hover:underline"
        >
          {linkLabel ?? "View details"}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
