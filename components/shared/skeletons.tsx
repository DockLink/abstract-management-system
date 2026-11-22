import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders shaped like the content they replace, so the page
 * doesn't jump when data arrives. Each announces itself once to screen readers.
 */

function Busy({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-8 space-y-3" aria-hidden>
      <Skeleton className="h-8 w-56 md:h-9" />
      <Skeleton className="h-5 w-full max-w-md" />
    </div>
  );
}

/** Table on desktop, card list on phones — mirrors <DataTable>. */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  label = "Loading list…",
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <Busy label={label}>
      <div className="hidden overflow-hidden rounded-lg border border-border bg-background md:block" aria-hidden>
        <div className="flex gap-6 border-b border-border bg-muted/50 px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-6 border-b border-border px-4 py-4 last:border-0">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className={cn("h-5 flex-1", c === 0 && "flex-[2]")} />
            ))}
          </div>
        ))}
      </div>
      <div className="md:hidden">
        <CardListSkeleton count={Math.min(rows, 3)} bare />
      </div>
    </Busy>
  );
}

export function CardListSkeleton({
  count = 3,
  label = "Loading…",
  bare = false,
}: {
  count?: number;
  label?: string;
  /** Internal: skip the status wrapper when nested in another skeleton. */
  bare?: boolean;
}) {
  const cards = (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <div className="flex justify-end gap-2 pt-1">
            <Skeleton className="h-control w-28" />
          </div>
        </div>
      ))}
    </div>
  );
  return bare ? cards : <Busy label={label}>{cards}</Busy>;
}

export function FormSkeleton({
  fields = 4,
  label = "Loading form…",
}: {
  fields?: number;
  label?: string;
}) {
  return (
    <Busy label={label}>
      <div className="space-y-6 rounded-lg border border-border bg-background p-4 md:p-6" aria-hidden>
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-control w-full" />
          </div>
        ))}
        <Skeleton className="h-control w-32" />
      </div>
    </Busy>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Busy label="Loading figures…">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border bg-background p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Whole-page placeholder: header + the body shape you name. */
export function PageSkeleton({
  variant = "table",
}: {
  variant?: "table" | "cards" | "form" | "dashboard";
}) {
  return (
    <div>
      <PageHeaderSkeleton />
      {variant === "table" ? <TableSkeleton /> : null}
      {variant === "cards" ? <CardListSkeleton /> : null}
      {variant === "form" ? <FormSkeleton /> : null}
      {variant === "dashboard" ? (
        <div className="space-y-6">
          <StatCardsSkeleton />
          <TableSkeleton rows={3} />
        </div>
      ) : null}
    </div>
  );
}
