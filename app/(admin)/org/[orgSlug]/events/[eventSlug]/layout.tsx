import { EventShell } from "@/components/shell/event-shell";
import { loadEventShellData } from "@/lib/nav/shell-data";

export const instant = false;

export default async function EventAdminLayout({
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
