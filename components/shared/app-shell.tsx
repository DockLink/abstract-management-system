"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Page chrome shared by admin, submitter and reviewer areas.
 *
 * - Desktop (lg+): fixed sidebar + sticky top bar.
 * - Phone/tablet: sticky top bar with a 44px menu button; the sidebar opens
 *   as a sheet. Without `sidebar`, no menu button is shown.
 *
 * `sidebar` is a render function so links inside can close the sheet.
 */
export function AppShell({
  sidebar,
  title,
  subtitle,
  topbar,
  actions,
  children,
  contentClassName,
  navLabel = "Navigation",
}: {
  sidebar?: (opts: { closeNav: () => void }) => ReactNode;
  /** Mobile top-bar title (e.g. event name). */
  title?: ReactNode;
  /** Mobile top-bar subtitle (e.g. current section). */
  subtitle?: ReactNode;
  /** Desktop top-bar content (breadcrumbs). */
  topbar?: ReactNode;
  /** Right side of both top bars (user menu, preview link). */
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  navLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeNav = () => setOpen(false);

  return (
    <div className="min-h-screen bg-surface">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-border bg-background px-2 lg:hidden">
        {sidebar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label={`Open ${navLabel.toLowerCase()}`}
          >
            <Menu />
          </Button>
        ) : (
          <span className="w-2" />
        )}
        <div className="min-w-0 flex-1 py-2">
          {title ? (
            <p className="truncate text-base font-semibold leading-tight">
              {title}
            </p>
          ) : null}
          {subtitle ? (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        ) : null}
      </div>

      <div className="flex min-h-screen">
        {sidebar ? (
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
            {sidebar({ closeNav })}
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 hidden h-16 items-center justify-between gap-3 border-b border-border bg-background px-6 lg:flex">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              {topbar ?? title}
            </div>
            {actions ? (
              <div className="flex shrink-0 items-center gap-2">{actions}</div>
            ) : null}
          </header>

          <main
            className={cn(
              "w-full flex-1 px-gutter py-6 md:px-6 md:py-8",
              contentClassName,
            )}
          >
            {children}
          </main>
        </div>
      </div>

      {sidebar ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-[min(20rem,85vw)] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{navLabel}</SheetTitle>
            </SheetHeader>
            {sidebar({ closeNav })}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

/** A sidebar nav link with a 44px hit area and a brand-coloured active rule. */
export function AppShellNavLink({
  active,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & { active?: boolean }) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-control items-center gap-3 rounded-md border-l-2 px-3 text-base transition-colors",
        active
          ? "border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "border-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
