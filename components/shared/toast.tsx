"use client";

import { useSyncExternalStore } from "react";
import { toast as sonnerToast } from "sonner";
import { Toaster as BaseToaster } from "@/components/ui/sonner";

const DESKTOP = "(min-width: 768px)";

function subscribe(cb: () => void) {
  const mql = window.matchMedia(DESKTOP);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

/**
 * App-wide toaster. Bottom-centre on phones (thumb reach, doesn't cover the
 * page title), top-right on desktop. Mounted once in app/layout.tsx.
 */
export function Toaster() {
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
  return (
    <BaseToaster
      position={desktop ? "top-right" : "bottom-center"}
      mobileOffset={16}
    />
  );
}

/**
 * Toast helpers. Keep the action's name through the flow: the "Publish"
 * button produces "Published". Errors say what failed and offer a retry
 * instead of apologising.
 */
export const toast = {
  success: (message: string, description?: string) =>
    sonnerToast.success(message, { description }),
  info: (message: string, description?: string) =>
    sonnerToast.info(message, { description }),
  warning: (message: string, description?: string) =>
    sonnerToast.warning(message, { description }),
  error: (
    message: string,
    opts?: { description?: string; onRetry?: () => void },
  ) =>
    sonnerToast.error(message, {
      description: opts?.description,
      action: opts?.onRetry
        ? { label: "Retry", onClick: opts.onRetry }
        : undefined,
    }),
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
};
