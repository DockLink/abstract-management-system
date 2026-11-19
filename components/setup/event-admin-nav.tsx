"use client";

import { AppShellNavLink } from "@/components/shared/app-shell";
import { usePathname } from "next/navigation";
import { EventIcons } from "@/lib/events/icons";
import { cn } from "@/lib/utils";

export const EVENT_ADMIN_NAV = [
  { href: "dashboard", label: "Dashboard", icon: EventIcons.dashboard },
  { href: "setup", label: "Setup", icon: EventIcons.setup },
  { href: "categories", label: "Categories", icon: EventIcons.categories },
  {
    href: "submission-types",
    label: "Submission types",
    icon: EventIcons.submissionTypes,
  },
  { href: "submissions", label: "Submissions", icon: EventIcons.submissions },
  { href: "reviews", label: "Reviews", icon: EventIcons.reviews },
  { href: "eligibility", label: "Eligibility", icon: EventIcons.eligibility },
  { href: "members", label: "Members", icon: EventIcons.members },
  { href: "settings", label: "Settings", icon: EventIcons.settings },
] as const;

export function eventSectionLabel(pathname: string, eventBase: string) {
  for (const item of EVENT_ADMIN_NAV) {
    const href = `${eventBase}/${item.href}`;
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return item.label;
    }
  }
  return null;
}

export function EventAdminNav({
  orgSlug,
  eventSlug,
  onNavigate,
  className,
}: {
  orgSlug: string;
  eventSlug: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const base = `/org/${orgSlug}/events/${eventSlug}`;

  return (
    <nav className={cn("flex flex-col gap-1 p-3", className)}>
      {EVENT_ADMIN_NAV.map((item) => {
        const href = `${base}/${item.href}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = item.icon;
        return (
          <AppShellNavLink
            key={item.href}
            href={href}
            onClick={onNavigate}
            active={active}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {item.label}
          </AppShellNavLink>
        );
      })}
    </nav>
  );
}
