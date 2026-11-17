"use client";

import { useMemo } from "react";
import { EventAdminProvider } from "@/components/setup/event-admin-context";
import type { EventLifecycleStatus } from "@/lib/events/status";

/** Registers event chrome metadata with AdminAppShell; does not render its own sidebar. */
export function EventAdminShell({
  eventSlug,
  eventName,
  eventEdition,
  status,
  children,
}: {
  orgSlug: string;
  orgName: string;
  eventSlug: string;
  eventName: string;
  eventEdition: string | null;
  status: EventLifecycleStatus;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ eventSlug, eventName, eventEdition, status }),
    [eventSlug, eventName, eventEdition, status],
  );

  return <EventAdminProvider value={value}>{children}</EventAdminProvider>;
}
