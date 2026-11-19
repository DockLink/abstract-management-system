import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/**
 * Where you are in the admin hierarchy. The last crumb is the current page
 * (not a link, aria-current). Long names truncate rather than wrap.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li
              key={`${c.label}-${i}`}
              className={cn("flex items-center gap-1", last ? "shrink-0" : "min-w-0 max-w-[18rem]")}
            >
              {i > 0 ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : null}
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="truncate rounded-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn("truncate", last ? "font-medium text-foreground" : "text-muted-foreground")}
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
