import { EventRoleType } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import {
  badRequest,
  notFound,
  ok,
  serverError,
  unprocessable,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeEventRole } from "@/lib/services/events/roles";
import { updateEventRoleSchema } from "@/lib/validators/orgs";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; roleId: string }>;
};

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, roleId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const existing = await prisma.eventRole.findFirst({
      where: { id: roleId, eventId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!existing) return notFound("Event role not found");

    if (existing.role !== EventRoleType.TRACK_CHAIR) {
      return unprocessable("Only TRACK_CHAIR roles support categoryIds updates");
    }

    const json = await request.json();
    const parsed = parseBody(updateEventRoleSchema, json);
    if (!parsed.success) return parsed.response;

    const categoryIds = parsed.data.categoryIds;
    if (categoryIds.length > 0) {
      const count = await prisma.category.count({
        where: { eventId, orgId, id: { in: categoryIds } },
      });
      if (count !== categoryIds.length) {
        return badRequest("One or more categoryIds do not belong to this event");
      }
    }

    const role = await prisma.eventRole.update({
      where: { id: roleId },
      data: { categoryIds },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "event_role.update",
      entity: "EventRole",
      entityId: roleId,
      before: serializeEventRole(existing),
      after: serializeEventRole(role),
    });

    return ok(serializeEventRole(role));
  } catch (error) {
    console.error("PATCH /events/:id/roles/:roleId", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, roleId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const existing = await prisma.eventRole.findFirst({
      where: { id: roleId, eventId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!existing) return notFound("Event role not found");

    await prisma.$transaction(async (tx) => {
      await tx.eventRole.delete({ where: { id: roleId } });

      // Category.chairUserId grants chair access (decisions/access.ts), so it
      // must not outlive the person's last role that can chair a track.
      if (
        existing.role === EventRoleType.TRACK_CHAIR ||
        existing.role === EventRoleType.EVENT_ADMIN
      ) {
        const remaining = await tx.eventRole.count({
          where: {
            eventId,
            userId: existing.userId,
            role: { in: [EventRoleType.TRACK_CHAIR, EventRoleType.EVENT_ADMIN] },
          },
        });
        if (remaining === 0) {
          await tx.category.updateMany({
            where: { eventId, orgId, chairUserId: existing.userId },
            data: { chairUserId: null },
          });
        }
      }
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "event_role.revoke",
      entity: "EventRole",
      entityId: roleId,
      before: serializeEventRole(existing),
    });

    return ok({ id: roleId, deleted: true });
  } catch (error) {
    console.error("DELETE /events/:id/roles/:roleId", error);
    return serverError();
  }
}
