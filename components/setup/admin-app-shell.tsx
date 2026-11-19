"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { AppShell, AppShellNavLink } from "@/components/shared/app-shell";
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
import { EventIcons } from "@/lib/events/icons";

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
        <p className="text-sm text-muted-foreground">Organisation</p>
        <p className="mt-0.5 truncate font-heading text-lg font-semibold text-sidebar-foreground">
          {orgName}
        </p>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex flex-col gap-1 p-3">
          <AppShellNavLink
            href={orgHref}
            onClick={onNavigate}
            active={eventsActive && !eventSlug}
          >
            <CalendarDays className="size-5 shrink-0" aria-hidden />
            Events
          </AppShellNavLink>
        </nav>

        {eventSlug ? (
          <>
            <Separator className="mx-3 w-auto" />
            <div className="px-4 pt-2">
              <Link
                href={orgHref}
                onClick={onNavigate}
                className="-ml-2 inline-flex min-h-control items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden />
                All events
              </Link>
              <p className="truncate text-base font-semibold text-sidebar-foreground">
                {eventName ?? eventSlug}
              </p>
              {eventEdition ? (
                <p className="truncate text-sm text-muted-foreground">
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

  const breadcrumbs = (
    <>
      <Link
        href={`/org/${orgSlug}`}
        className="truncate text-muted-foreground hover:text-foreground"
      >
        {orgName}
      </Link>
      {eventSlug ? (
        <>
          <span className="text-muted-foreground" aria-hidden>/</span>
          <span className="truncate font-medium">{eventName ?? eventSlug}</span>
          {status ? <StatusBadge status={status} size="sm" /> : null}
          {section ? (
            <>
              <span className="text-muted-foreground" aria-hidden>/</span>
              <span className="truncate text-muted-foreground">{section}</span>
            </>
          ) : null}
        </>
      ) : (
        <>
          <span className="text-muted-foreground" aria-hidden>/</span>
          <span className="font-medium">Events</span>
        </>
      )}
    </>
  );

  return (
    <AppShell
      title={eventName ?? orgName}
      subtitle={eventName ? (section ?? eventEdition ?? "Event admin") : "Events"}
      topbar={<nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">{breadcrumbs}</nav>}
      actions={
        <>
          {eventSlug ? (
            <Button variant="outline" size="sm" className="hidden lg:inline-flex" asChild>
              <a href={`/${orgSlug}/${eventSlug}`} target="_blank" rel="noreferrer">
                <PreviewIcon data-icon="inline-start" />
                Preview public page
              </a>
            </Button>
          ) : null}
          <AdminUserMenu />
        </>
      }
      sidebar={({ closeNav }) => (
        <SidebarNav
          orgSlug={orgSlug}
          orgName={orgName}
          eventSlug={eventSlug}
          eventName={eventName}
          eventEdition={eventEdition}
          onNavigate={closeNav}
        />
      )}
    >
      {children}
    </AppShell>
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
