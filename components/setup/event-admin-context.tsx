"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { EventLifecycleStatus } from "@/lib/events/status";

export type EventAdminContextValue = {
  eventSlug: string;
  eventName: string;
  eventEdition: string | null;
  status: EventLifecycleStatus;
};

type SetEventMeta = (value: EventAdminContextValue | null) => void;

const EventMetaContext = createContext<EventAdminContextValue | null>(null);
const SetEventMetaContext = createContext<SetEventMeta | null>(null);

/** Owns event meta so AdminAppShell (ancestor) can read what EventAdminProvider (descendant) registers. */
export function AdminShellStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [eventMeta, setEventMetaState] =
    useState<EventAdminContextValue | null>(null);

  const setEventMeta = useCallback<SetEventMeta>((value) => {
    setEventMetaState(value);
  }, []);

  const setValue = useMemo(() => setEventMeta, [setEventMeta]);

  return (
    <SetEventMetaContext.Provider value={setValue}>
      <EventMetaContext.Provider value={eventMeta}>
        {children}
      </EventMetaContext.Provider>
    </SetEventMetaContext.Provider>
  );
}

export function EventAdminProvider({
  value,
  children,
}: {
  value: EventAdminContextValue;
  children: React.ReactNode;
}) {
  const setEventMeta = useContext(SetEventMetaContext);

  useEffect(() => {
    if (!setEventMeta) return;
    setEventMeta(value);
    return () => setEventMeta(null);
  }, [setEventMeta, value]);

  return children;
}

export function useEventAdminContext() {
  return useContext(EventMetaContext);
}
