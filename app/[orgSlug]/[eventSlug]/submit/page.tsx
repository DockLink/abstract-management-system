import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";
import { SubmissionFormWizard } from "@/components/submissions/submission-form-wizard";

export const instant = false;

export default async function SubmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { id: existingSubmissionId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const nextUrl = `/${orgSlug}/${eventSlug}/submit${existingSubmissionId ? `?id=${existingSubmissionId}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  return (
    <main className="min-h-screen bg-surface">
      <SubmissionFormWizard
        orgId={orgId}
        eventId={eventId}
        orgSlug={orgSlug}
        eventSlug={eventSlug}
        existingSubmissionId={existingSubmissionId || null}
      />
    </main>
  );
}
