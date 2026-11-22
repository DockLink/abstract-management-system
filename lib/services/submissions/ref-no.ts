import { prisma } from "@/lib/db/prisma";

/**
 * Generate a reference number for a submission.
 * Format: <eventPrefix><YY>-<NNNN> e.g. SLOA26-0042
 * eventPrefix is derived from the first 4 chars of the event slug, uppercased.
 */
export async function generateRefNo(eventId: string, eventSlug: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = eventSlug.replace(/-/g, "").slice(0, 4).toUpperCase();

  // Count existing submitted (non-draft) submissions for sequence
  const count = await prisma.submission.count({
    where: { eventId, refNo: { not: null } },
  });

  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}${year}-${seq}`;
}
