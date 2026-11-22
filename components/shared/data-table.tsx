"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import type { LucideIcon } from "lucide-react";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Classes for <th>/<td> on desktop (width, alignment). */
  className?: string;
  /** Mobile card role. `title` = card heading, `meta` = chip row above it,
   *  `field` = label/value pair (default), `hidden` = desktop only. */
  mobile?: "title" | "meta" | "field" | "hidden";
};

/**
 * Lists that stay readable on a phone. md+: a real <table> that scrolls inside
 * its own container if it must. Below md: one card per row, built from the
 * same column definitions — no clipped columns, actions always visible.
 *
 * Handles the four states itself: loading → skeleton, error → retry,
 * empty → next action, data → rows.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  rowActions,
  onRowClick,
  rowClassName,
  loading = false,
  error,
  onRetry,
  empty,
  caption,
  className,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Buttons/menus for a row. Rendered in the last column / card footer. */
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /** Extra classes per row/card, e.g. to highlight flagged rows. */
  rowClassName?: (row: T) => string | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: {
    icon?: LucideIcon;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
  };
  /** Accessible table name (visually hidden). */
  caption?: string;
  className?: string;
}) {
  if (loading) return <TableSkeleton columns={Math.min(columns.length, 5)} />;
  if (error) {
    return (
      <ErrorState
        compact
        title="This list didn't load"
        description={error}
        onRetry={onRetry}
      />
    );
  }
  if (rows.length === 0 && empty) {
    return (
      <EmptyState
        compact
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        action={empty.action}
      />
    );
  }

  const titleCol = columns.find((c) => c.mobile === "title") ?? columns[0];
  const metaCols = columns.filter((c) => c.mobile === "meta");
  const fieldCols = columns.filter(
    (c) => c !== titleCol && (c.mobile === undefined || c.mobile === "field"),
  );

  return (
    <div className={className}>
      {/* Desktop table */}
      <div className="relative hidden overflow-x-auto rounded-lg border border-border bg-background md:block">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cn("px-4 py-3 font-medium whitespace-nowrap text-muted-foreground", c.className)}
                >
                  {c.header}
                </th>
              ))}
              {rowActions ? (
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border last:border-0",
                  onRowClick && "cursor-pointer hover:bg-muted/40",
                  rowClassName?.(row),
                )}
              >
                {columns.map((c) => (
                  <td key={c.id} className={cn("px-4 py-3 align-middle", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
                {rowActions ? (
                  <td
                    className="px-4 py-2 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center justify-end gap-1">
                      {rowActions(row)}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li
            key={getRowId(row)}
            className={cn("rounded-lg border border-border bg-background", rowClassName?.(row))}
          >
            <div
              className={cn("p-4", onRowClick && "cursor-pointer")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {metaCols.length ? (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {metaCols.map((c) => (
                    <span key={c.id}>{c.cell(row)}</span>
                  ))}
                </div>
              ) : null}
              <div className="text-base font-semibold text-foreground">
                {titleCol.cell(row)}
              </div>
              {fieldCols.length ? (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {fieldCols.map((c) => (
                    <div key={c.id} className="contents">
                      <dt className="text-muted-foreground">{c.header}</dt>
                      <dd className="min-w-0 text-foreground">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
            {rowActions ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-2">
                {rowActions(row)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
