import { EventRoleType } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { getEventInOrg } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeEventRole } from "@/lib/services/events/roles";
import { joinEventRoleSchema } from "@/lib/validators/orgs";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

const ROLE_MAP = {
  SUBMITTER: EventRoleType.SUBMITTER,
  DELEGATE: EventRoleType.DELEGATE,
} as const;

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const event = await getEventInOrg(orgId, eventId);
    if (!event) return notFound("Event not found");

    const json = await request.json();
    const parsed = parseBody(joinEventRoleSchema, json);
    if (!parsed.success) return parsed.response;

    const roleType = ROLE_MAP[parsed.data.role];
    const userId = auth.ctx.user.id;

    const existing = await prisma.eventRole.findUnique({
      where: {
        eventId_userId_role: {
          eventId,
          userId,
          role: roleType,
        },
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (existing) {
      return ok({
        created: false,
        role: serializeEventRole(existing),
      });
    }

    const role = await prisma.eventRole.create({
      data: {
        eventId,
        userId,
        role: roleType,
        categoryIds: [],
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: userId,
      action: "event_role.join",
      entity: "EventRole",
      entityId: role.id,
      after: serializeEventRole(role),
    });

    return ok(
      {
        created: true,
        role: serializeEventRole(role),
      },
      201,
    );
  } catch (error) {
    console.error("POST /events/:id/roles/join", error);
    return serverError(
      error instanceof Error ? error.message : "Internal server error",
    );
  }
}
