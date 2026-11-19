import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";
import { ReviewScreen } from "@/components/reviews/review-screen";

export const instant = false;

export default async function ReviewScreenRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string; assignmentId: string }>;
}) {
  const { orgSlug, eventSlug, assignmentId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const nextUrl = `/${orgSlug}/${eventSlug}/reviews/${assignmentId}`;
    redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  return (
    <ReviewScreen
      orgId={orgId}
      eventId={eventId}
      orgSlug={orgSlug}
      eventSlug={eventSlug}
      assignmentId={assignmentId}
    />
  );
}

