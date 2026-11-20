"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VIEW_ROLE_LABEL, type ViewRole } from "@/lib/nav/event-nav";
import type { ShellEventSummary } from "@/lib/nav/shell-data";
import { cn } from "@/lib/utils";

/**
 * Event name block at the top of the sidebar. When the person can reach more
 * than one event in this organisation it becomes a switcher.
 */
export function EventSwitcher({
  current,
  events,
  hrefFor,
  allEventsHref,
  collapsed = false,
  logo,
}: {
  current: ShellEventSummary;
  events: ShellEventSummary[];
  hrefFor: (slug: string) => string;
  /** Org events list, for admins. */
  allEventsHref?: string;
  collapsed?: boolean;
  logo: React.ReactNode;
}) {
  const others = events.filter((e) => e.slug !== current.slug);
  const body = (
    <>
      {logo}
      {collapsed ? null : (
        <span className="min-w-0 flex-1 text-left">
          <span className="line-clamp-2 text-base leading-tight font-semibold">{current.name}</span>
          {current.edition ? (
            <span className="block truncate text-sm text-muted-foreground">{current.edition}</span>
          ) : null}
        </span>
      )}
    </>
  );

  if (others.length === 0 && !allEventsHref) {
    return <div className={cn("flex min-h-control items-center gap-3", collapsed && "justify-center")}>{body}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={collapsed ? `Switch event (current: ${current.name})` : undefined}
          className={cn(
            "flex min-h-control w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-sidebar-accent/60",
            collapsed && "justify-center",
          )}
        >
          {collapsed ? null : <span className="sr-only">Switch event: </span>}
          {body}
          {collapsed ? null : <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-sm font-normal text-muted-foreground">Switch event</DropdownMenuLabel>
        {[current, ...others].map((e) => (
          <DropdownMenuItem key={e.slug} asChild>
            <Link href={hrefFor(e.slug)} aria-current={e.slug === current.slug ? "true" : undefined}>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{e.name}</span>
                {e.edition ? <span className="block truncate text-sm text-muted-foreground">{e.edition}</span> : null}
              </span>
              {e.slug === current.slug ? <Check className="text-brand-ink" aria-hidden /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
        {allEventsHref ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={allEventsHref}>All events</Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * "Viewing as" — only rendered when someone holds more than one role for the
 * event. Switching changes which navigation they see; it doesn't change what
 * they're allowed to do.
 */
export function ViewAsSwitcher({
  roles,
  current,
  onChange,
  variant = "button",
}: {
  roles: ViewRole[];
  current: ViewRole;
  onChange: (role: ViewRole) => void;
  /** `list` renders inline radio rows (for the mobile slide-over). */
  variant?: "button" | "list";
}) {
  if (roles.length < 2) return null;

  if (variant === "list") {
    return (
      <div role="radiogroup" aria-label="Viewing as" className="grid gap-1">
        <p className="px-3 pb-1 text-sm text-muted-foreground">Viewing as</p>
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={r === current}
            onClick={() => onChange(r)}
            className={cn(
              "flex min-h-control items-center justify-between rounded-md px-3 text-left text-base",
              r === current ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
            )}
          >
            {VIEW_ROLE_LABEL[r]}
            {r === current ? <Check className="size-4 text-brand-ink" aria-hidden /> : null}
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye data-icon="inline-start" aria-hidden />
          <span className="text-muted-foreground">Viewing as</span>{" "}
          <span className="font-semibold">{VIEW_ROLE_LABEL[current]}</span>
          <span className="sr-only">. Change view</span>
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-sm font-normal text-muted-foreground">
          You have {roles.length} roles here
        </DropdownMenuLabel>
        {roles.map((r) => (
          <DropdownMenuItem key={r} onSelect={() => onChange(r)}>
            <span className="flex-1">{VIEW_ROLE_LABEL[r]}</span>
            {r === current ? <Check className="text-brand-ink" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
