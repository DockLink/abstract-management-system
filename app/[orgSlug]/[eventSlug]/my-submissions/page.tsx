import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";
import { SubmitterDashboard } from "@/components/submissions/submitter-dashboard";

export const instant = false;

export default async function MySubmissionsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const nextUrl = `/${orgSlug}/${eventSlug}/my-submissions`;
    redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  return (
    <div>
      <SubmitterDashboard
        orgId={orgId}
        eventId={eventId}
        orgSlug={orgSlug}
        eventSlug={eventSlug}
      />
    </div>
  );
}

