"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, MoreHorizontal } from "lucide-react";

import { AppShell, AppShellNavLink } from "@/components/shared/app-shell";
import { BrandScope } from "@/components/shared/brand-scope";
import { Breadcrumbs, type Crumb } from "@/components/shared/breadcrumbs";
import { StatusBadge } from "@/components/shared/status-badge";
import { EventSwitcher, ViewAsSwitcher } from "@/components/shell/switchers";
import { UserMenu } from "@/components/shell/user-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useStoredPreference } from "@/lib/hooks/use-stored-preference";
import {
  activeItem,
  eventPaths,
  isItemActive,
  navFor,
  resolveViewRole,
  roleHome,
  viewRolesFor,
  VIEW_ROLE_LABEL,
  type NavGroup,
  type NavItem,
  type ViewRole,
} from "@/lib/nav/event-nav";
import type { EventShellData } from "@/lib/nav/shell-data";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "ams:sidebar-collapsed";

/* ─── Event mark (logo or monogram) ─────────────────────────────────────── */

function EventMark({ name, logoUrl, size = 40 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    return (
      <span
        className="relative block shrink-0 overflow-hidden rounded-md border border-border bg-white"
        style={{ width: size, height: size }}
      >
        <Image src={logoUrl} alt="" fill sizes={`${size}px`} className="object-contain p-1" unoptimized />
      </span>
    );
  }
  const letters = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-md bg-primary font-heading font-semibold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {letters || "•"}
    </span>
  );
}

/* ─── Sidebar navigation ─────────────────────────────────────────────────── */

function NavGroups({
  groups,
  pathname,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <nav aria-label="Event" className="flex flex-col gap-4 px-3 pb-4">
      {groups.map((g, gi) => (
        <div key={g.id} role="group" aria-labelledby={collapsed ? undefined : `nav-${g.id}`} aria-label={collapsed ? g.label : undefined}>
          {collapsed ? (
            gi > 0 ? <Separator className="mb-3" /> : null
          ) : (
            <p id={`nav-${g.id}`} className="px-3 pb-1 text-sm font-medium text-muted-foreground">
              {g.label}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => (
              <li key={item.id}>
                <NavEntry item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavEntry({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  if (!item.href) {
    // Not built yet (e.g. ticketing). Visible so people know it's coming, not clickable.
    return (
      <div
        aria-disabled="true"
        title={collapsed ? `${item.label} — coming soon` : undefined}
        className={cn(
          "flex min-h-control items-center gap-3 rounded-md px-3 text-base text-muted-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="size-5 shrink-0 opacity-60" aria-hidden />
        {collapsed ? <span className="sr-only">{item.label} — coming soon</span> : (
          <>
            <span className="flex-1">{item.label}</span>
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">Coming soon</Badge>
          </>
        )}
      </div>
    );
  }
  return (
    <AppShellNavLink
      href={item.href}
      active={isItemActive(item, pathname)}
      collapsed={collapsed}
      label={item.label}
      icon={<Icon className="size-5 shrink-0" aria-hidden />}
      onClick={onNavigate}
    >
      {item.label}
    </AppShellNavLink>
  );
}

/* ─── Mobile bottom tab bar ──────────────────────────────────────────────── */

function BottomTabs({
  items,
  pathname,
  showMore,
  moreActive,
  onMore,
}: {
  items: NavItem[];
  pathname: string;
  showMore: boolean;
  /** The current page lives under "More" — highlight it. */
  moreActive: boolean;
  onMore: () => void;
}) {
  return (
    <nav aria-label="Main" className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length + (showMore ? 1 : 0)}, minmax(0, 1fr))` }}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(item, pathname);
        return (
          <Link
            key={item.id}
            href={item.href!}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-medium",
              active ? "text-brand-ink" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-primary" /> : null}
            <Icon className="size-6" aria-hidden />
            <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
          </Link>
        );
      })}
      {showMore ? (
        <button
          type="button"
          onClick={onMore}
          aria-label={moreActive ? "More (current page is here)" : "More"}
          className={cn(
            "relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-medium",
            moreActive ? "text-brand-ink" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {moreActive ? <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-primary" /> : null}
          <MoreHorizontal className="size-6" aria-hidden />
          More
        </button>
      ) : null}
    </nav>
  );
}

/* ─── Powered by footer ──────────────────────────────────────────────────── */

export function PoweredBy({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-12 border-t border-border pt-5 pb-2 text-center text-sm text-muted-foreground", className)}>
      Powered by <span className="font-semibold text-foreground">DocLink</span>
    </footer>
  );
}

/* ─── The shell ──────────────────────────────────────────────────────────── */

/**
 * Chrome for every event page — admin console and author/reviewer portal.
 * Navigation is chosen from the viewer's event roles (see lib/nav/event-nav):
 * presentation only, pages still enforce access through the API.
 */
export function EventShell({
  data,
  children,
}: {
  data: EventShellData;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { org, event, user, viewer, events } = data;
  const paths = useMemo(() => eventPaths(org.slug, event.slug), [org.slug, event.slug]);

  const roles = useMemo(() => viewRolesFor(viewer), [viewer]);
  const [preferred, setPreferred] = useStoredPreference(`ams:view-as:${event.id}`);
  const role = resolveViewRole(roles, pathname, paths, (preferred as ViewRole | null) ?? null);
  const groups = useMemo(() => navFor(role, paths), [role, paths]);
  const active = activeItem(groups, pathname);

  const [collapsedPref, setCollapsedPref] = useStoredPreference(COLLAPSE_KEY);
  const collapsed = collapsedPref === "1";
  const [menuOpen, setMenuOpen] = useState(false);

  const inAdminArea = pathname.startsWith(paths.admin);
  // The review screen is a focused, full-height workspace with its own header.
  const focusMode = pathname.startsWith(`${paths.portal}/reviews/`);

  if (focusMode) {
    return <BrandScope brand={event.primaryColor}>{children}</BrandScope>;
  }

  const switchRole = (next: ViewRole) => {
    setPreferred(next);
    setMenuOpen(false);
    router.push(roleHome(next, paths));
  };

  const section = inAdminArea ? pathname.slice(paths.admin.length + 1).split("/")[0] : "";
  const eventHref = (slug: string) => {
    const p = eventPaths(org.slug, slug);
    if (inAdminArea && section) return `${p.admin}/${section}`;
    return role === "admin" || role === "chair" ? roleHome(role, p) : p.portal;
  };

  // Breadcrumbs: Org › Event › Area › Page on admin pages; Event › Page in the portal.
  const crumbs: Crumb[] = [];
  if (inAdminArea) {
    if (role === "admin") crumbs.push({ label: org.name, href: `/org/${org.slug}` });
    crumbs.push({ label: event.name, href: roleHome(role, paths) });
    if (active) crumbs.push({ label: active.item.label, href: active.item.href });
  } else {
    crumbs.push({ label: event.name, href: paths.portal });
    if (active && active.item.href !== paths.portal) crumbs.push({ label: active.item.label });
  }

  const linkable = groups.flatMap((g) => g.items).filter((i) => i.href);
  const tabs = linkable.filter((i) => i.primary).slice(0, 4);
  const showMore = linkable.length > tabs.length || roles.length > 1;
  const showTabs = !!user && tabs.length >= 2;

  const userMenu = (compact: boolean) => (
    <UserMenu user={user} reviewsAnywhere={data.reviewsAnywhere} returnTo={pathname} compact={compact} />
  );

  return (
    <BrandScope brand={event.primaryColor}>
      <AppShell
        navLabel="Event menu"
        collapsed={collapsed}
        onCollapsedChange={(c) => setCollapsedPref(c ? "1" : null)}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        leading={<EventMark name={event.name} logoUrl={event.logoUrl} size={32} />}
        title={event.name}
        subtitle={active?.item.label ?? (user ? VIEW_ROLE_LABEL[role] : org.name)}
        topbar={
          <div className="flex min-w-0 items-center gap-3">
            <Breadcrumbs items={crumbs} />
            {role === "admin" ? <StatusBadge status={event.status} size="sm" /> : null}
          </div>
        }
        actions={
          <>
            <ViewAsSwitcher roles={roles} current={role} onChange={switchRole} />
            {role === "admin" && inAdminArea ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={paths.portal} target="_blank">
                  <ExternalLink data-icon="inline-start" />
                  Public page
                </Link>
              </Button>
            ) : null}
            {userMenu(false)}
          </>
        }
        mobileActions={userMenu(true)}
        bottomBar={
          showTabs ? (
            <BottomTabs
              items={tabs}
              pathname={pathname}
              showMore={showMore}
              moreActive={!!active && !tabs.some((t) => t.id === active.item.id)}
              onMore={() => setMenuOpen(true)}
            />
          ) : undefined
        }
        footer={event.showPoweredBy ? <PoweredBy /> : undefined}
        contentClassName={inAdminArea ? undefined : "px-0 pt-0 md:px-0 md:pt-0"}
        sidebar={({ closeNav, collapsed: rail }) => (
          <div className="flex min-h-full flex-col">
            <div className={cn("border-b border-sidebar-border px-3 pt-4 pb-3", rail && "px-2")}>
              {rail ? null : (
                <p className="truncate px-1.5 pb-2 text-sm text-muted-foreground">
                  {role === "admin" ? (
                    <Link href={`/org/${org.slug}`} onClick={closeNav} className="hover:text-foreground hover:underline">
                      {org.name}
                    </Link>
                  ) : (
                    org.name
                  )}
                </p>
              )}
              <EventSwitcher
                current={{ slug: event.slug, name: event.name, edition: event.edition }}
                events={events}
                hrefFor={eventHref}
                allEventsHref={role === "admin" ? `/org/${org.slug}` : undefined}
                collapsed={rail}
                logo={<EventMark name={event.name} logoUrl={event.logoUrl} />}
              />
            </div>

            {/* Role switcher lives in the slide-over on phones (desktop has it in the top bar). */}
            {!rail && roles.length > 1 ? (
              <div className="border-b border-sidebar-border px-3 py-3 lg:hidden">
                <ViewAsSwitcher roles={roles} current={role} onChange={switchRole} variant="list" />
              </div>
            ) : null}

            <div className="pt-4">
              <NavGroups groups={groups} pathname={pathname} collapsed={rail} onNavigate={closeNav} />
            </div>

            {!rail && !user ? (
              <p className="mt-auto px-6 pb-6 text-sm text-muted-foreground">
                Sign in to submit an abstract or see your reviews.
              </p>
            ) : null}
          </div>
        )}
      >
        {children}
      </AppShell>
    </BrandScope>
  );
}
