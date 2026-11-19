"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { AppShell, AppShellNavLink } from "@/components/shared/app-shell";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { UserMenu } from "@/components/shell/user-menu";
import { useStoredPreference } from "@/lib/hooks/use-stored-preference";
import type { OrgShellData } from "@/lib/nav/shell-data";
import { cn } from "@/lib/utils";

/** Organisation-level chrome (the events list). Event pages use EventShell. */
export function OrgShell({ data, children }: { data: OrgShellData; children: ReactNode }) {
  const pathname = usePathname();
  const { org, user } = data;
  const [collapsedPref, setCollapsedPref] = useStoredPreference("ams:sidebar-collapsed");
  const collapsed = collapsedPref === "1";
  const eventsHref = `/org/${org.slug}`;

  return (
    <AppShell
      navLabel="Organisation menu"
      collapsed={collapsed}
      onCollapsedChange={(c) => setCollapsedPref(c ? "1" : null)}
      title={org.name}
      subtitle="Events"
      topbar={<Breadcrumbs items={[{ label: org.name, href: eventsHref }, { label: "Events" }]} />}
      actions={<UserMenu user={user} reviewsAnywhere={data.reviewsAnywhere} returnTo={pathname} />}
      mobileActions={<UserMenu user={user} reviewsAnywhere={data.reviewsAnywhere} returnTo={pathname} compact />}
      sidebar={({ closeNav, collapsed: rail }) => (
        <div>
          <div className={cn("border-b border-sidebar-border px-4 py-4", rail && "px-2 text-center")}>
            {rail ? (
              <span className="font-heading text-lg font-semibold" title={org.name}>
                {org.name.slice(0, 1)}
              </span>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Organisation</p>
                <p className="mt-0.5 truncate font-heading text-lg font-semibold">{org.name}</p>
              </>
            )}
          </div>
          <nav aria-label="Organisation" className="p-3">
            <AppShellNavLink
              href={eventsHref}
              active={pathname === eventsHref}
              collapsed={rail}
              label="Events"
              icon={<CalendarDays className="size-5 shrink-0" aria-hidden />}
              onClick={closeNav}
            >
              Events
            </AppShellNavLink>
          </nav>
        </div>
      )}
    >
      {children}
    </AppShell>
  );
}
