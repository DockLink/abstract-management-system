import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignSystemGallery } from "@/components/dev/design-system-gallery";

export const metadata: Metadata = {
  title: "Design system · AMS",
  robots: { index: false, follow: false },
};

/**
 * Living reference for tokens and shared components.
 * Development only: `next build` inlines NODE_ENV, so production always 404s.
 */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignSystemGallery />;
}
