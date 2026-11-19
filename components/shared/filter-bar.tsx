"use client";

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Search + filters above a list. Phones: everything stacks full-width
 * (selects included — wrap each in a div or pass full-width triggers).
 * md+: one row. Shows "Clear filters" only when something is active, and a
 * result count so an empty table is never a mystery.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search",
  searchLabel = "Search",
  children,
  activeCount = 0,
  onClear,
  resultCount,
  className,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  /** Filter controls (Selects). */
  children?: ReactNode;
  /** Number of active filters (excluding search). */
  activeCount?: number;
  onClear?: () => void;
  resultCount?: { shown: number; total?: number; noun?: string };
  className?: string;
}) {
  const hasActive = activeCount > 0 || !!search;
  const noun = resultCount?.noun ?? "results";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        {onSearchChange ? (
          <div className="relative md:min-w-64 md:flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchLabel}
              className="pl-10"
            />
          </div>
        ) : null}
        {children ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:items-center [&_[data-slot=select-trigger]]:w-full md:[&_[data-slot=select-trigger]]:w-auto md:[&_[data-slot=select-trigger]]:min-w-44">
            {children}
          </div>
        ) : null}
        {hasActive && onClear ? (
          <Button variant="ghost" onClick={onClear} className="self-start md:self-auto">
            <X data-icon="inline-start" />
            Clear filters
          </Button>
        ) : null}
      </div>
      {resultCount ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {resultCount.total !== undefined && resultCount.total !== resultCount.shown
            ? `Showing ${resultCount.shown} of ${resultCount.total} ${noun}`
            : `${resultCount.shown} ${noun}`}
        </p>
      ) : null}
    </div>
  );
}
