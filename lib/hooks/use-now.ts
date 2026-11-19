"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared ticking clock. Returns `null` during SSR and the first client render
 * so time-relative UI never causes a hydration mismatch (and never reads
 * Date.now() while prerendering under Cache Components).
 */
const listeners = new Set<() => void>();
let current: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
    queueMicrotask(() => listeners.forEach((l) => l()));
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): Date | null {
  const ms = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return ms === null ? null : new Date(ms);
}
