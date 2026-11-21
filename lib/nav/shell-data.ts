import { connection } from "next/server";
import { apiFetchServer } from "@/lib/api/server";
import { resolveOrgBySlug, resolveOrgEventBySlug } from "@/lib/events/resolve";
import { getEventLifecycleStatus, type EventLifecycleStatus } from "@/lib/events/status";
import { createSignedAssetUrl } from "@/lib/services/events/storage";
import { getAccessToken } from "@/lib/supabase/server";
import type { EventDto, MeResponse } from "@/lib/types/api";
import type { ShellViewer } from "@/lib/nav/event-nav";

export type ShellUser = {
  fullName: string | null;
  email: string;
  phone: string | null;
  slmcNo: string | null;
};

export type ShellEventSummary = { slug: string; name: string; edition: string | null };

export type EventShellData = {
  org: { id: string; slug: string; name: string };
  event: {
    id: string;
    slug: string;
    name: string;
    edition: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    showPoweredBy: boolean;
    status: EventLifecycleStatus;
  };
  /** Null when signed out. */
  user: ShellUser | null;
  viewer: ShellViewer | null;
  /** Events this person can switch to within the organisation. */
  events: ShellEventSummary[];
  /** Holds a reviewer role on any event (for the "My reviews" menu link). */
  reviewsAnywhere: boolean;
};

async function loadMe(): Promise<MeResponse | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const me = await apiFetchServer<MeResponse>("/api/v1/auth/me", { token });
  return me.ok ? me.data : null;
}

function toUser(me: MeResponse): ShellUser {
  return {
    fullName: me.user.fullName,
    email: me.user.email,
    phone: me.user.phone,
    slmcNo: me.user.slmcNo,
  };
}

/**
 * Everything the event shell needs, loaded once per layout render.
 * Reads only what the signed-in person can already see: /auth/me for their
 * own roles, the org event list only when they belong to the org.
 */
export async function loadEventShellData(
  orgSlug: string,
  eventSlug: string,
): Promise<EventShellData> {
  // Event status depends on the current time: render per request.
  await connection();
  const [{ org, event }, me] = await Promise.all([
    resolveOrgEventBySlug(orgSlug, eventSlug),
    loadMe(),
  ]);

  const settings =
    typeof event.settings === "object" && event.settings !== null
      ? (event.settings as Record<string, unknown>)
      : {};

  const logoUrl = event.logoPath ? await createSignedAssetUrl(event.logoPath).catch(() => null) : null;

  const status = getEventLifecycleStatus({
    submissionOpenAt: event.submissionOpenAt?.toISOString() ?? null,
    submissionCloseAt: event.submissionCloseAt?.toISOString() ?? null,
    reviewDeadlineAt: event.reviewDeadlineAt?.toISOString() ?? null,
    notificationAt: event.notificationAt?.toISOString() ?? null,
    earlyBirdEndAt: event.earlyBirdEndAt?.toISOString() ?? null,
    registrationCloseAt: event.registrationCloseAt?.toISOString() ?? null,
  });

  let viewer: ShellViewer | null = null;
  let events: ShellEventSummary[] = [];

  if (me) {
    const membership = me.organisations.find((m) => m.organisation.id === org.id);
    viewer = {
      isPlatformAdmin: me.isPlatformAdmin,
      orgRole: membership?.role ?? null,
      eventRoles: me.eventRoles.filter((r) => r.event.id === event.id).map((r) => r.role),
    };

    if (me.isPlatformAdmin || membership) {
      const list = await apiFetchServer<EventDto[]>(`/api/v1/orgs/${org.id}/events`);
      if (list.ok) {
        events = list.data.map((e) => ({ slug: e.slug, name: e.name, edition: e.edition }));
      }
    }
    if (events.length === 0) {
      const seen = new Map<string, ShellEventSummary>();
      for (const r of me.eventRoles) {
        if (r.event.orgId === org.id && !seen.has(r.event.slug)) {
          seen.set(r.event.slug, { slug: r.event.slug, name: r.event.name, edition: r.event.edition ?? null });
        }
      }
      events = [...seen.values()];
    }
  }

  return {
    org: { id: org.id, slug: org.slug, name: org.name },
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      edition: event.edition,
      logoUrl,
      primaryColor: event.primaryColor,
      // "Powered by DocLink" is always on in v1 (Settings → Branding);
      // honour an explicit `showPoweredBy: false` if it is ever stored.
      showPoweredBy: settings.showPoweredBy !== false,
      status,
    },
    user: me ? toUser(me) : null,
    viewer,
    events,
    reviewsAnywhere: !!me?.eventRoles.some((r) => r.role === "REVIEWER"),
  };
}

export type OrgShellData = {
  org: { id: string; slug: string; name: string };
  user: ShellUser | null;
  reviewsAnywhere: boolean;
  /** Presentation only: shows the Team link. The API enforces org admin. */
  canManageOrg: boolean;
  isPlatformAdmin: boolean;
};

export async function loadOrgShellData(orgSlug: string): Promise<OrgShellData> {
  const [org, me] = await Promise.all([resolveOrgBySlug(orgSlug), loadMe()]);
  return {
    org: { id: org.id, slug: org.slug, name: org.name },
    user: me ? toUser(me) : null,
    reviewsAnywhere: !!me?.eventRoles.some((r) => r.role === "REVIEWER"),
    canManageOrg:
      !!me?.isPlatformAdmin ||
      !!me?.organisations.some((m) => m.organisation.id === org.id && m.role === "ORG_ADMIN"),
    isPlatformAdmin: !!me?.isPlatformAdmin,
  };
}
