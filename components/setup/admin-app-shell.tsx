"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarDays, Menu } from "lucide-react";
import { AdminUserMenu } from "@/components/setup/admin-user-menu";
import {
  AdminShellStateProvider,
  useEventAdminContext,
} from "@/components/setup/event-admin-context";
import {
  EventAdminNav,
  eventSectionLabel,
} from "@/components/setup/event-admin-nav";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EventIcons } from "@/lib/events/icons";
import { cn } from "@/lib/utils";

function SidebarNav({
  orgSlug,
  orgName,
  eventSlug,
  eventName,
  eventEdition,
  onNavigate,
}: {
  orgSlug: string;
  orgName: string;
  eventSlug: string | null;
  eventName: string | null;
  eventEdition: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const orgHref = `/org/${orgSlug}`;
  const eventsActive = pathname === orgHref || pathname === `${orgHref}/`;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-4">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
          Abstract
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-sidebar-foreground">
          {orgName}
        </p>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex flex-col gap-1 p-3">
          <Link
            href={orgHref}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors",
              eventsActive && !eventSlug
                ? "border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <CalendarDays className="size-4 shrink-0" />
            Events
          </Link>
        </nav>

        {eventSlug ? (
          <>
            <Separator className="mx-3 w-auto" />
            <div className="px-4 pt-3 pb-1">
              <Link
                href={orgHref}
                onClick={onNavigate}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="size-3.5" />
                All events
              </Link>
              <p className="mt-2 truncate text-sm font-semibold text-sidebar-foreground">
                {eventName ?? eventSlug}
              </p>
              {eventEdition ? (
                <p className="truncate text-xs text-muted-foreground">
                  {eventEdition}
                </p>
              ) : null}
            </div>
            <EventAdminNav
              orgSlug={orgSlug}
              eventSlug={eventSlug}
              onNavigate={onNavigate}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function AdminAppShellFrame({
  orgSlug,
  orgName,
  children,
}: {
  orgSlug: string;
  orgName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const eventCtx = useEventAdminContext();
  const [open, setOpen] = useState(false);
  const PreviewIcon = EventIcons.preview;

  const eventMatch = useMemo(() => {
    const prefix = `/org/${orgSlug}/events/`;
    if (!pathname.startsWith(prefix)) return null;
    const rest = pathname.slice(prefix.length);
    const slug = rest.split("/")[0];
    return slug || null;
  }, [pathname, orgSlug]);

  const eventSlug = eventCtx?.eventSlug ?? eventMatch;
  const eventName = eventCtx?.eventName ?? null;
  const eventEdition = eventCtx?.eventEdition ?? null;
  const status = eventCtx?.status ?? null;

  const eventBase =
    eventSlug != null ? `/org/${orgSlug}/events/${eventSlug}` : null;
  const section =
    eventBase != null ? eventSectionLabel(pathname, eventBase) : null;

  return (
    <div className="min-h-screen bg-surface">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background px-4 py-3 lg:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
        >
          <Menu />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {eventName ?? orgName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {eventName ? (section ?? eventEdition ?? "Event admin") : "Events"}
          </p>
        </div>
        <AdminUserMenu />
      </div>

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
          <SidebarNav
            orgSlug={orgSlug}
            orgName={orgName}
            eventSlug={eventSlug}
            eventName={eventName}
            eventEdition={eventEdition}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-3 border-b border-border bg-background px-6 lg:flex">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <Link
                href={`/org/${orgSlug}`}
                className="truncate text-muted-foreground hover:text-primary"
              >
                {orgName}
              </Link>
              {eventSlug ? (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="truncate font-medium">
                    {eventName ?? eventSlug}
                  </span>
                  {status ? <StatusBadge status={status} /> : null}
                  {section ? (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="truncate text-muted-foreground">
                        {section}
                      </span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="font-medium">Events</span>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {eventSlug ? (
                <Button variant="outline" className="h-9" asChild>
                  <a
                    href={`/${orgSlug}/${eventSlug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <PreviewIcon data-icon="inline-start" />
                    Preview public page
                  </a>
                </Button>
              ) : null}
              <AdminUserMenu />
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarNav
            orgSlug={orgSlug}
            orgName={orgName}
            eventSlug={eventSlug}
            eventName={eventName}
            eventEdition={eventEdition}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function AdminAppShell({
  orgSlug,
  orgName,
  children,
}: {
  orgSlug: string;
  orgName: string;
  children: React.ReactNode;
}) {
  return (
    <AdminShellStateProvider>
      <AdminAppShellFrame orgSlug={orgSlug} orgName={orgName}>
        {children}
      </AdminAppShellFrame>
    </AdminShellStateProvider>
  );
}
