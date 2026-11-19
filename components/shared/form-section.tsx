import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A titled group of fields. On phones the section bleeds to the gutter with
 * rules top and bottom (more room for inputs); from md it is a bordered card.
 * `footer` is for the section's own save action — it wraps rather than
 * overflowing, primary action last (right on desktop, bottom on mobile).
 */
export function FormSection({
  title,
  description,
  aside,
  footer,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Right of the title, e.g. an AutosaveIndicator or "Add author" button. */
  aside?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "-mx-gutter border-y border-border bg-background md:mx-0 md:rounded-lg md:border",
        className,
      )}
    >
      <div className="flex flex-col gap-3 px-gutter pt-5 sm:flex-row sm:items-start sm:justify-between md:px-6 md:pt-6">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-[65ch] text-base text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="grid gap-5 px-gutter py-5 md:px-6 md:py-6">{children}</div>
      {footer ? (
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface/60 px-gutter py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end md:rounded-b-lg md:px-6 [&>*]:w-full sm:[&>*]:w-auto">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
