import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

export async function resolveOrgBySlug(orgSlug: string) {
  const org = await prisma.organisation.findUnique({
    where: { slug: orgSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoPath: true,
      address: true,
    },
  });
  if (!org) notFound();
  return org;
}

export async function resolveOrgEventBySlug(orgSlug: string, eventSlug: string) {
  const org = await resolveOrgBySlug(orgSlug);
  const event = await prisma.event.findFirst({
    where: {
      orgId: org.id,
      slug: eventSlug,
      deletedAt: null,
    },
  });
  if (!event) notFound();
  return {
    org,
    event,
    orgId: org.id,
    eventId: event.id,
  };
}
