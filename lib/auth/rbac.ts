import {
  EventRoleType,
  OrgRole,
  type Event,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { forbidden, notFound } from "@/lib/api/response";
import type { AuthContext } from "./supabase";

export function requirePlatformAdmin(ctx: AuthContext) {
  if (!ctx.isPlatformAdmin) {
    return { ok: false as const, response: forbidden("Platform admin required") };
  }
  return { ok: true as const };
}

export async function requireOrgAdmin(ctx: AuthContext, orgId: string) {
  if (ctx.isPlatformAdmin) {
    const org = await prisma.organisation.findUnique({ where: { id: orgId } });
    if (!org) return { ok: false as const, response: notFound("Organisation not found") };
    return { ok: true as const, org };
  }

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: ctx.user.id } },
    include: { organisation: true },
  });

  if (!membership || membership.role !== OrgRole.ORG_ADMIN) {
    return { ok: false as const, response: forbidden("Org admin required") };
  }

  return { ok: true as const, org: membership.organisation };
}

export async function requireOrgAccess(ctx: AuthContext, orgId: string) {
  if (ctx.isPlatformAdmin) {
    const org = await prisma.organisation.findUnique({ where: { id: orgId } });
    if (!org) return { ok: false as const, response: notFound("Organisation not found") };
    return { ok: true as const, org };
  }

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: ctx.user.id } },
    include: { organisation: true },
  });

  if (!membership) {
    return { ok: false as const, response: forbidden("Not a member of this organisation") };
  }

  return { ok: true as const, org: membership.organisation, membership };
}

export async function getEventInOrg(orgId: string, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId, deletedAt: null },
  });
  return event;
}

export async function requireEventAdmin(
  ctx: AuthContext,
  orgId: string,
  eventId: string,
) {
  const event = await getEventInOrg(orgId, eventId);
  if (!event) {
    return { ok: false as const, response: notFound("Event not found") };
  }

  if (ctx.isPlatformAdmin) {
    return { ok: true as const, event };
  }

  const orgMembership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: ctx.user.id } },
  });
  if (orgMembership?.role === OrgRole.ORG_ADMIN) {
    return { ok: true as const, event };
  }

  const eventRole = await prisma.eventRole.findFirst({
    where: {
      eventId,
      userId: ctx.user.id,
      role: EventRoleType.EVENT_ADMIN,
    },
  });

  if (!eventRole) {
    return { ok: false as const, response: forbidden("Event admin required") };
  }

  return { ok: true as const, event };
}

export async function requireEventRole(
  ctx: AuthContext,
  orgId: string,
  eventId: string,
  roles: EventRoleType[],
) {
  const event = await getEventInOrg(orgId, eventId);
  if (!event) {
    return { ok: false as const, response: notFound("Event not found") };
  }

  if (ctx.isPlatformAdmin) {
    return { ok: true as const, event };
  }

  const orgMembership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: ctx.user.id } },
  });
  if (orgMembership?.role === OrgRole.ORG_ADMIN) {
    return { ok: true as const, event };
  }

  const eventRole = await prisma.eventRole.findFirst({
    where: {
      eventId,
      userId: ctx.user.id,
      role: { in: roles },
    },
  });

  if (!eventRole) {
    return { ok: false as const, response: forbidden("Insufficient event role") };
  }

  return { ok: true as const, event, eventRole };
}

export type EventWithOrg = Event & {
  organisation?: { id: string; slug: string; name: string };
};
