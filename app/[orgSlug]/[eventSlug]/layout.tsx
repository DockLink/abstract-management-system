import { EventShell } from "@/components/shell/event-shell";
import { loadEventShellData } from "@/lib/nav/shell-data";

export const instant = false;

/** Author, reviewer and public pages for one event share the event shell. */
export default async function EventPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const data = await loadEventShellData(orgSlug, eventSlug);
  return <EventShell data={data}>{children}</EventShell>;
}
