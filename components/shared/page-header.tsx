import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page title block. The serif title is the one typographic flourish in the
 * system; everything around it stays quiet.
 *
 * - `back` renders a 44px back link above the title (mobile-friendly).
 * - `meta` sits under the description (status badge, deadline, ref no.).
 * - `actions` stack full-width under the title on phones, align right from sm.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 md:mb-8", className)}>
      {back ? (
        <Link
          href={back.href}
          className="-ml-2 mb-2 inline-flex min-h-control items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-[-0.01em] text-foreground md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-[65ch] text-base text-muted-foreground">
              {description}
            </p>
          ) : null}
          {meta ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-col gap-2 *:w-full sm:flex-row sm:flex-wrap sm:items-center sm:*:w-auto">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
