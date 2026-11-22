"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SidebarRenderProps = {
  closeNav: () => void;
  /** Desktop rail mode — render icons only. Always false inside the sheet. */
  collapsed: boolean;
};

/**
 * Page chrome shared by admin, author and reviewer areas.
 *
 * - Desktop (lg+): sidebar (optionally collapsible to an icon rail) + sticky
 *   top bar for breadcrumbs and actions.
 * - Phone/tablet: sticky top bar with a 44px menu button that opens the
 *   sidebar as a slide-over; optional fixed bottom tab bar.
 */
export function AppShell({
  sidebar,
  title,
  subtitle,
  leading,
  topbar,
  actions,
  mobileActions,
  bottomBar,
  footer,
  children,
  contentClassName,
  navLabel = "Navigation",
  collapsed = false,
  onCollapsedChange,
  menuOpen,
  onMenuOpenChange,
}: {
  sidebar?: (opts: SidebarRenderProps) => ReactNode;
  /** Mobile top-bar title (e.g. event name). */
  title?: ReactNode;
  /** Mobile top-bar subtitle (e.g. current section). */
  subtitle?: ReactNode;
  /** Mobile top-bar mark before the title (e.g. event logo). */
  leading?: ReactNode;
  /** Desktop top-bar content (breadcrumbs). */
  topbar?: ReactNode;
  /** Right side of the desktop top bar. */
  actions?: ReactNode;
  /** Right side of the mobile top bar. Defaults to `actions`. */
  mobileActions?: ReactNode;
  /** Fixed bottom tab bar on phones (hidden from lg). */
  bottomBar?: ReactNode;
  /** Rendered after the page content (e.g. "Powered by DocLink"). */
  footer?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  navLabel?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Control the mobile slide-over from outside (e.g. a "More" tab). */
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = menuOpen ?? ownOpen;
  const setOpen = onMenuOpenChange ?? setOwnOpen;
  const closeNav = () => setOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background px-4 py-3 text-base font-medium text-foreground shadow-overlay focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:outline-2 focus:outline-ring"
      >
        Skip to main content
      </a>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex min-h-14 items-center gap-1 border-b border-border bg-background px-1.5 lg:hidden">
        {sidebar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label={`Open ${navLabel.toLowerCase()}`}
            aria-expanded={open}
          >
            <Menu />
          </Button>
        ) : (
          <span className="w-2.5" />
        )}
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1 px-1.5 py-2">
          {title ? (
            <p className="truncate text-base leading-tight font-semibold">{title}</p>
          ) : null}
          {subtitle ? (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {(mobileActions ?? actions) ? (
          <div className="flex shrink-0 items-center gap-1">{mobileActions ?? actions}</div>
        ) : null}
      </div>

      <div className="flex flex-1">
        {sidebar ? (
          <aside
            data-collapsed={collapsed || undefined}
            className={cn(
              "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
              collapsed ? "w-[4.5rem]" : "w-72",
            )}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {sidebar({ closeNav, collapsed })}
            </div>
            {onCollapsedChange ? (
              <div className="border-t border-sidebar-border p-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size={collapsed ? "icon" : "default"}
                      className={cn("text-muted-foreground", collapsed ? "mx-auto flex" : "w-full justify-start")}
                      onClick={() => onCollapsedChange(!collapsed)}
                      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                      aria-expanded={!collapsed}
                    >
                      {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                      {collapsed ? null : <span className="text-sm">Collapse sidebar</span>}
                    </Button>
                  </TooltipTrigger>
                  {collapsed ? <TooltipContent side="right">Expand sidebar</TooltipContent> : null}
                </Tooltip>
              </div>
            ) : null}
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 hidden min-h-16 items-center justify-between gap-4 border-b border-border bg-background px-6 lg:flex">
            <div className="flex min-w-0 items-center gap-2 text-sm">{topbar ?? title}</div>
            {actions ? (
              <div className="flex shrink-0 items-center gap-2">{actions}</div>
            ) : null}
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              "outline-none",
              "w-full flex-1 px-4 py-6 md:px-6 md:py-8",
              bottomBar && "pb-28 lg:pb-8",
              contentClassName,
            )}
          >
            {children}
            {footer}
          </main>
        </div>
      </div>

      {bottomBar ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
          {bottomBar}
        </div>
      ) : null}

      {sidebar ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="flex w-[min(20rem,88vw)] flex-col gap-0 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{navLabel}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {sidebar({ closeNav, collapsed: false })}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

/**
 * A sidebar nav link: 44px hit area, brand-coloured active rule, and an
 * icon-only rail mode with a tooltip when the sidebar is collapsed.
 */
export function AppShellNavLink({
  active,
  collapsed = false,
  icon,
  label,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & {
  active?: boolean;
  collapsed?: boolean;
  /** Icon element; required for the collapsed rail. */
  icon?: ReactNode;
  /** Accessible name when collapsed (defaults to children if a string). */
  label?: string;
}) {
  const link = (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "relative flex min-h-control items-center gap-3 rounded-md px-3 text-base transition-colors",
        "before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:bg-sidebar-primary"
          : "text-sidebar-foreground/80 before:bg-transparent hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        collapsed && "justify-center px-0",
        className,
      )}
      {...props}
    >
      {icon}
      {collapsed ? null : children}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
