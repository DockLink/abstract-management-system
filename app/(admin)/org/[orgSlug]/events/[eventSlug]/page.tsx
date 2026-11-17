import { redirect } from "next/navigation";

export const instant = false;

export default async function EventIndexPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  redirect(`/org/${orgSlug}/events/${eventSlug}/dashboard`);
}
