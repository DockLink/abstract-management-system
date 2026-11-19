import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";
import { ReviewerDashboard } from "@/components/reviews/reviewer-dashboard";

export const instant = false;

export default async function EventReviewerDashboardRoute({
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
    const nextUrl = `/${orgSlug}/${eventSlug}/reviews`;
    redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  return (
    <div>
      <ReviewerDashboard
        orgId={orgId}
        eventId={eventId}
        orgSlug={orgSlug}
        eventSlug={eventSlug}
      />
    </div>
  );
}

