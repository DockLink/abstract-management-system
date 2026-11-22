import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetchServer } from "@/lib/api/server";
import type { MeResponse } from "@/lib/types/api";
import { getAccessToken } from "@/lib/supabase/server";

export const instant = false;

const ADMIN_AREA_ROLES = new Set(["EVENT_ADMIN", "TRACK_CHAIR"]);

export default async function HomePage() {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const me = await apiFetchServer<MeResponse>("/api/v1/auth/me", { token });
  if (!me.ok) redirect("/login");

  const firstOrg = me.data.organisations[0]?.organisation;
  if (firstOrg) {
    redirect(`/org/${firstOrg.slug}`);
  }
  if (me.data.isPlatformAdmin) {
    redirect("/platform");
  }

  // People invited to one event have a role there but no org membership.
  const events = new Map<string, { href: string; name: string; edition: string | null; orgName: string }>();
  for (const { role, event } of me.data.eventRoles) {
    const admin = `/org/${event.organisation.slug}/events/${event.slug}`;
    const portal = `/${event.organisation.slug}/${event.slug}`;
    const href = ADMIN_AREA_ROLES.has(role) ? admin : portal;
    const existing = events.get(event.id);
    if (!existing || href === admin) {
      events.set(event.id, { href, name: event.name, edition: event.edition ?? null, orgName: event.organisation.name });
    }
  }

  if (events.size > 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-gutter py-8">
        <h1 className="font-heading text-3xl font-semibold">Your events</h1>
        <p className="mt-1 text-base text-muted-foreground">Choose an event to continue.</p>
        <ul className="mt-6 grid gap-3">
          {[...events.entries()].map(([id, e]) => (
            <li key={id}>
              <Link href={e.href} className="block min-h-control rounded-lg border border-border bg-card p-4 hover:bg-surface">
                <span className="block font-medium">{e.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {e.edition ? `${e.edition} · ` : ""}{e.orgName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Abstract Management System
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You are signed in, but you are not a member of any organisation yet.
        Ask a platform admin to invite you.
      </p>
    </main>
  );
}
