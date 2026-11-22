export const instant = false;

/**
 * Org-level pages render their own shell: the events list uses OrgShell and
 * event pages use EventShell (app/(admin)/org/[orgSlug]/events/[eventSlug]/layout.tsx).
 */
export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return children;
}
