/**
 * Role-aware event navigation — PRESENTATION ONLY.
 *
 * This decides which links a person sees. It never grants or denies access:
 * every page still enforces permissions through the API guards in
 * lib/auth/rbac.ts. The role → area mapping mirrors what those guards allow
 * today, so people aren't shown links that would only return 403.
 */
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FilePlus2,
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Ticket,
  Users,
} from "lucide-react";

export type ViewRole =
  | "admin"
  | "chair"
  | "reviewer"
  | "submitter"
  | "finance"
  | "delegate";

export const VIEW_ROLE_LABEL: Record<ViewRole, string> = {
  admin: "Event admin",
  chair: "Track chair",
  reviewer: "Reviewer",
  submitter: "Author",
  finance: "Finance officer",
  delegate: "Delegate",
};

/** Highest first: the default view when someone holds several roles. */
const ROLE_PRIORITY: ViewRole[] = [
  "admin",
  "chair",
  "reviewer",
  "submitter",
  "finance",
  "delegate",
];

const EVENT_ROLE_TO_VIEW: Record<string, ViewRole> = {
  EVENT_ADMIN: "admin",
  TRACK_CHAIR: "chair",
  REVIEWER: "reviewer",
  SUBMITTER: "submitter",
  FINANCE_OFFICER: "finance",
  DELEGATE: "delegate",
};

export type ShellViewer = {
  isPlatformAdmin: boolean;
  /** Org membership role for this event's organisation, if any. */
  orgRole: "ORG_ADMIN" | "MEMBER" | null;
  /** EventRoleType values held for this event. */
  eventRoles: string[];
};

/**
 * The views a person can switch between for one event. Platform and org
 * admins see the admin view (rbac.requireEventAdmin lets them through).
 * Signed-in people with no role get the author view — anyone may submit.
 */
export function viewRolesFor(viewer: ShellViewer | null): ViewRole[] {
  if (!viewer) return ["submitter"];
  const roles = new Set<ViewRole>();
  if (viewer.isPlatformAdmin || viewer.orgRole === "ORG_ADMIN") roles.add("admin");
  for (const r of viewer.eventRoles) {
    const v = EVENT_ROLE_TO_VIEW[r];
    if (v) roles.add(v);
  }
  if (roles.size === 0) roles.add("submitter");
  return ROLE_PRIORITY.filter((r) => roles.has(r));
}

export type NavItem = {
  id: string;
  label: string;
  /** Undefined for items that aren't built yet (shown as "Coming soon"). */
  href?: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom tab bar (max 4). */
  primary?: boolean;
  /** Shorter label for the bottom tab bar. */
  shortLabel?: string;
  /** Extra path prefixes that should mark this item active. */
  match?: string[];
};

export type NavGroup = { id: string; label: string; items: NavItem[] };

export type EventPaths = {
  /** /org/{org}/events/{event} */
  admin: string;
  /** /{org}/{event} */
  portal: string;
};

export function eventPaths(orgSlug: string, eventSlug: string): EventPaths {
  return {
    admin: `/org/${orgSlug}/events/${eventSlug}`,
    portal: `/${orgSlug}/${eventSlug}`,
  };
}

export function navFor(role: ViewRole, p: EventPaths): NavGroup[] {
  const eventPage: NavItem = {
    id: "event-page",
    label: "Event page",
    shortLabel: "Event",
    href: p.portal,
    icon: Globe,
  };

  switch (role) {
    case "admin":
      return [
        {
          id: "overview",
          label: "Overview",
          items: [
            { id: "dashboard", label: "Dashboard", shortLabel: "Home", href: `${p.admin}/dashboard`, icon: LayoutDashboard, primary: true },
          ],
        },
        {
          id: "abstracts",
          label: "Abstracts",
          items: [
            { id: "submissions", label: "Submissions", shortLabel: "Abstracts", href: `${p.admin}/submissions`, icon: Inbox, primary: true },
            { id: "reviews", label: "Reviews", href: `${p.admin}/reviews`, icon: ClipboardCheck, primary: true },
          ],
        },
        {
          id: "programme",
          label: "Programme setup",
          items: [
            { id: "setup", label: "Event setup", shortLabel: "Setup", href: `${p.admin}/setup`, icon: SlidersHorizontal, primary: true },
            { id: "categories", label: "Tracks and chairs", href: `${p.admin}/categories`, icon: Tags },
            { id: "submission-types", label: "Submission types", href: `${p.admin}/submission-types`, icon: FileText },
            { id: "eligibility", label: "Eligibility", href: `${p.admin}/eligibility`, icon: ShieldCheck },
          ],
        },
        {
          id: "people",
          label: "People",
          items: [{ id: "members", label: "Members", href: `${p.admin}/members`, icon: Users }],
        },
        {
          id: "event",
          label: "Event",
          items: [
            { id: "settings", label: "Settings", href: `${p.admin}/settings`, icon: Settings },
            { ...eventPage, label: "Public event page" },
          ],
        },
      ];

    case "chair":
      return [
        {
          id: "abstracts",
          label: "Your tracks",
          items: [
            { id: "submissions", label: "Submissions", shortLabel: "Abstracts", href: `${p.admin}/submissions`, icon: Inbox, primary: true },
            { id: "reviews", label: "Reviews", href: `${p.admin}/reviews`, icon: ClipboardCheck, primary: true },
          ],
        },
        { id: "event", label: "Event", items: [{ ...eventPage, primary: true }] },
      ];

    case "reviewer":
      return [
        {
          id: "reviewing",
          label: "Reviewing",
          items: [
            { id: "my-reviews", label: "Abstracts to review", shortLabel: "Reviews", href: `${p.portal}/reviews`, icon: ClipboardList, primary: true },
            { id: "all-review-events", label: "All my review events", shortLabel: "All events", href: "/my-reviews", icon: CalendarDays },
          ],
        },
        { id: "event", label: "Event", items: [{ ...eventPage, primary: true }] },
      ];

    case "submitter":
      return [
        {
          id: "abstracts",
          label: "Your abstracts",
          items: [
            { id: "my-submissions", label: "My submissions", shortLabel: "Mine", href: `${p.portal}/my-submissions`, icon: ListChecks, primary: true },
            { id: "submit", label: "Submit an abstract", shortLabel: "Submit", href: `${p.portal}/submit`, icon: FilePlus2, primary: true },
          ],
        },
        { id: "event", label: "Event", items: [{ ...eventPage, primary: true }] },
      ];

    case "finance":
      return [
        {
          id: "finance",
          label: "Finance",
          items: [
            { id: "registrations", label: "Registrations", icon: BadgeCheck },
            { id: "payments", label: "Payments and bank slips", icon: CreditCard },
          ],
        },
        { id: "event", label: "Event", items: [{ ...eventPage, primary: true }] },
      ];

    case "delegate":
      return [
        {
          id: "attending",
          label: "Attending",
          items: [{ id: "my-registration", label: "My registration", icon: Ticket }],
        },
        { id: "event", label: "Event", items: [{ ...eventPage, primary: true }] },
      ];
  }
}

/** Where "Viewing as <role>" takes you. */
export function roleHome(role: ViewRole, p: EventPaths): string {
  switch (role) {
    case "admin":
      return `${p.admin}/dashboard`;
    case "chair":
      return `${p.admin}/reviews`;
    case "reviewer":
      return `${p.portal}/reviews`;
    case "submitter":
      return `${p.portal}/my-submissions`;
    default:
      return p.portal;
  }
}

/**
 * Which view a URL belongs to, when that's unambiguous. Admin-area pages can
 * be admin or chair; the public event page fits every role (null).
 */
export function viewRoleForPath(
  pathname: string,
  p: EventPaths,
): ViewRole | "admin-area" | null {
  if (pathname.startsWith(p.admin)) return "admin-area";
  if (pathname.startsWith(`${p.portal}/reviews`)) return "reviewer";
  if (
    pathname.startsWith(`${p.portal}/submit`) ||
    pathname.startsWith(`${p.portal}/my-submissions`)
  ) {
    return "submitter";
  }
  return null;
}

/** Pick the view to show for this URL, honouring the stored preference. */
export function resolveViewRole(
  available: ViewRole[],
  pathname: string,
  p: EventPaths,
  preferred: ViewRole | null,
): ViewRole {
  const fromPath = viewRoleForPath(pathname, p);
  const has = (r: ViewRole | null): r is ViewRole => !!r && available.includes(r);

  if (fromPath === "admin-area") {
    if (has(preferred) && (preferred === "admin" || preferred === "chair")) return preferred;
    if (has("admin")) return "admin";
    if (has("chair")) return "chair";
  } else if (fromPath && has(fromPath)) {
    return fromPath;
  }
  if (has(preferred)) return preferred;
  return available[0];
}

export function isItemActive(item: NavItem, pathname: string): boolean {
  if (!item.href) return false;
  const prefixes = [item.href, ...(item.match ?? [])];
  return prefixes.some((h) =>
    // The event page is the portal root: only exact matches count.
    h.split("/").length <= 3 ? pathname === h : pathname === h || pathname.startsWith(`${h}/`),
  );
}

export function activeItem(groups: NavGroup[], pathname: string) {
  for (const g of groups) {
    for (const item of g.items) {
      if (isItemActive(item, pathname)) return { group: g, item };
    }
  }
  return null;
}
