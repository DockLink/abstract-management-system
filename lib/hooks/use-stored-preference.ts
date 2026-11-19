"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A per-browser UI preference (sidebar collapsed, "viewing as" role).
 * Server render and first client render return `fallback`, so markup never
 * mismatches; storage failures (private mode, blocked storage) fall back too.
 */
const EVENT = "ams:preference";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  const onStorage = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onStorage);
  };
}

export function useStoredPreference(
  key: string,
  fallback: string | null = null,
): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key) ?? fallback,
    () => fallback,
  );

  const set = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, next);
      } catch {
        // Preference just won't persist.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, set];
}
