import { EventRoleType, ReviewerInviteStatus } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, conflict, ok, serverError } from "@/lib/api/response";
import { requireAuth, serializeAppUser } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { resolveOrInviteUser } from "@/lib/services/auth/invite";
import { writeAuditLog } from "@/lib/services/events/audit";
import { inviteReviewerSchema } from "@/lib/validators/reviews";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(inviteReviewerSchema, json);
    if (!parsed.success) return parsed.response;

    const categoryIds = parsed.data.categoryIds ?? [];
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

    try {
      const role = await prisma.eventRole.upsert({
        where: {
          eventId_userId_role: {
            eventId,
            userId: user.id,
            role: EventRoleType.REVIEWER,
          },
        },
        create: {
          eventId,
          userId: user.id,
          role: EventRoleType.REVIEWER,
          categoryIds,
          maxLoad: parsed.data.maxLoad ?? 20,
          invitationStatus: ReviewerInviteStatus.PENDING,
        },
        update: {
          categoryIds: parsed.data.categoryIds !== undefined ? categoryIds : undefined,
          maxLoad: parsed.data.maxLoad !== undefined ? parsed.data.maxLoad : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              institution: true,
            },
          },
        },
      });

      await writeAuditLog({
        orgId,
        eventId,
        actorId: auth.ctx.user.id,
        action: "reviewer.invite",
        entity: "EventRole",
        entityId: role.id,
        after: {
          roleId: role.id,
          userId: role.userId,
          email: role.user.email,
          categoryIds: role.categoryIds,
          maxLoad: role.maxLoad,
          invited,
        },
      });

      return ok(
        {
          invited,
          user: serializeAppUser(user),
          reviewer: {
            id: role.id,
            userId: role.userId,
            email: role.user.email,
            fullName: role.user.fullName,
            institution: role.user.institution,
            categoryIds: role.categoryIds,
            maxLoad: role.maxLoad,
            invitationStatus: role.invitationStatus,
            confidentialityAgreedAt: role.confidentialityAgreedAt,
          },
        },
        invited ? 201 : 200,
      );
    } catch (error) {
      console.error("Error creating reviewer role:", error);
      return conflict("Could not invite reviewer for this event");
    }
  } catch (error) {
    console.error("POST /events/:id/reviewers/invite", error);
    return serverError(
      error instanceof Error ? error.message : "Internal server error",
    );
  }
}

