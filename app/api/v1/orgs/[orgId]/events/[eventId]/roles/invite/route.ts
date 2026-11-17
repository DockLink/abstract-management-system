import { EventRoleType, Prisma } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import {
  badRequest,
  conflict,
  ok,
  serverError,
  unprocessable,
} from "@/lib/api/response";
import { requireAuth, serializeAppUser } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { resolveOrInviteUser } from "@/lib/services/auth/invite";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeEventRole } from "@/lib/services/events/roles";
import { inviteEventRoleSchema } from "@/lib/validators/orgs";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

const INVITED_ROLES = new Set([
  "EVENT_ADMIN",
  "TRACK_CHAIR",
  "REVIEWER",
  "FINANCE_OFFICER",
]);

const SELF_JOIN_ROLES = new Set(["SUBMITTER", "DELEGATE"]);

const ROLE_MAP: Record<string, EventRoleType> = {
  EVENT_ADMIN: EventRoleType.EVENT_ADMIN,
  TRACK_CHAIR: EventRoleType.TRACK_CHAIR,
  REVIEWER: EventRoleType.REVIEWER,
  FINANCE_OFFICER: EventRoleType.FINANCE_OFFICER,
};

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const json = await request.json();

    if (
      json?.role &&
      typeof json.role === "string" &&
      SELF_JOIN_ROLES.has(json.role)
    ) {
      return unprocessable(
        "SUBMITTER and DELEGATE must self-join via POST .../roles/join",
        { role: json.role },
      );
    }

    if (
      json?.role &&
      typeof json.role === "string" &&
      !INVITED_ROLES.has(json.role)
    ) {
      return unprocessable(
        "Only EVENT_ADMIN, TRACK_CHAIR, REVIEWER, and FINANCE_OFFICER can be invited",
        { role: json.role },
      );
    }

    const parsed = parseBody(inviteEventRoleSchema, json);
    if (!parsed.success) return parsed.response;

    const categoryIds = parsed.data.categoryIds ?? [];
    if (parsed.data.role !== "TRACK_CHAIR" && categoryIds.length > 0) {
      return badRequest("categoryIds are only valid for TRACK_CHAIR");
    }

    if (categoryIds.length > 0) {
      const count = await prisma.category.count({
        where: { eventId, orgId, id: { in: categoryIds } },
      });
      if (count !== categoryIds.length) {
        return badRequest("One or more categoryIds do not belong to this event");
      }
    }

    const { user, invited } = await resolveOrInviteUser({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
    });

    const roleType = ROLE_MAP[parsed.data.role];

    try {
      const role = await prisma.eventRole.upsert({
        where: {
          eventId_userId_role: {
            eventId,
            userId: user.id,
            role: roleType,
          },
        },
        create: {
          eventId,
          userId: user.id,
          role: roleType,
          categoryIds: parsed.data.role === "TRACK_CHAIR" ? categoryIds : [],
        },
        update: {
          categoryIds:
            parsed.data.role === "TRACK_CHAIR" &&
            parsed.data.categoryIds !== undefined
              ? categoryIds
              : undefined,
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      await writeAuditLog({
        orgId,
        eventId,
        actorId: auth.ctx.user.id,
        action: "event_role.invite",
        entity: "EventRole",
        entityId: role.id,
        after: { ...serializeEventRole(role), invited },
      });

      return ok(
        {
          invited,
          user: serializeAppUser(user),
          role: serializeEventRole(role),
        },
        invited ? 201 : 200,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return conflict("User already has this role on the event");
      }
      throw error;
    }
  } catch (error) {
    console.error("POST /events/:id/roles/invite", error);
    return serverError(
      error instanceof Error ? error.message : "Internal server error",
    );
  }
}
