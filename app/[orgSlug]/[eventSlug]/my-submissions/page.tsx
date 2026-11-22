import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";
import { SubmitterDashboard } from "@/components/submissions/submitter-dashboard";
import { apiFetchServer } from "@/lib/api/server";
import type { PublicEventDto } from "@/lib/types/api";

export const instant = false;

export default async function MySubmissionsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  // Auth lookups read the clock; render at request time.
  await connection();
  const { orgSlug, eventSlug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const nextUrl = `/${orgSlug}/${eventSlug}/my-submissions`;
    redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  const [{ orgId, eventId }, pub] = await Promise.all([
    resolveOrgEventBySlug(orgSlug, eventSlug),
    apiFetchServer<PublicEventDto>(`/api/v1/public/orgs/${orgSlug}/events/${eventSlug}`, { token: null }),
  ]);

  return (
    <div>
      <SubmitterDashboard
        orgId={orgId}
        eventId={eventId}
        orgSlug={orgSlug}
        eventSlug={eventSlug}
        deadline={pub.ok ? pub.data.event.keyDates.submissionCloseAt : null}
        canSubmit={pub.ok ? pub.data.portalState.canSubmit : true}
      />
    </div>
  );
}

