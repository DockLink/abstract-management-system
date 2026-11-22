import { EventRoleType, ReviewAssignmentStatus } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin, requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { updateReviewerSchema } from "@/lib/validators/reviews";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; reviewerId: string }>;
};

async function findReviewerRole(eventId: string, reviewerId: string) {
  return prisma.eventRole.findFirst({
    where: {
      eventId,
      role: EventRoleType.REVIEWER,
      OR: [{ id: reviewerId }, { userId: reviewerId }],
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
}

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, reviewerId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const role = await findReviewerRole(eventId, reviewerId);
    if (!role) return notFound("Reviewer not found");

    const [assignments, categories] = await Promise.all([
      prisma.reviewAssignment.findMany({
        where: { eventId, reviewerId: role.userId },
        include: {
          submission: {
            select: {
              id: true,
              refNo: true,
              title: true,
              status: true,
              category: { select: { id: true, name: true } },
            },
          },
          review: {
            select: {
              recommendation: true,
              isDraft: true,
              submittedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.category.findMany({
        where: { orgId, eventId },
        select: { id: true, name: true },
      }),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return ok({
      id: role.id,
      userId: role.userId,
      email: role.user.email,
      fullName: role.user.fullName,
      institution: role.user.institution,
      categoryIds: role.categoryIds,
      categories: role.categoryIds
        .map((id) => ({ id, name: categoryMap.get(id) ?? id }))
        .filter((c) => categoryMap.has(c.id)),
      maxLoad: role.maxLoad ?? 20,
      invitationStatus: role.invitationStatus,
      confidentialityAgreedAt: role.confidentialityAgreedAt
        ? role.confidentialityAgreedAt.toISOString()
        : null,
      assignments: assignments.map((a) => ({
        id: a.id,
        submissionId: a.submissionId,
        refNo: a.submission.refNo,
        title: a.submission.title,
        status: a.status,
        category: a.submission.category,
        reviewStatus: a.review ? (a.review.isDraft ? "DRAFT" : "SUBMITTED") : "NONE",
        recommendation: a.review?.recommendation ?? null,
        dueAt: a.dueAt ? a.dueAt.toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("GET /events/:id/reviewers/:reviewerId", error);
    return serverError();
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, reviewerId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const role = await findReviewerRole(eventId, reviewerId);
    if (!role) return notFound("Reviewer not found");

    const json = await request.json();
    const parsed = parseBody(updateReviewerSchema, json);
    if (!parsed.success) return parsed.response;

    if (parsed.data.categoryIds && parsed.data.categoryIds.length > 0) {
      const count = await prisma.category.count({
        where: { eventId, orgId, id: { in: parsed.data.categoryIds } },
      });
      if (count !== parsed.data.categoryIds.length) {
        return badRequest("One or more categoryIds do not belong to this event");
      }
    }

    const updated = await prisma.eventRole.update({
      where: { id: role.id },
      data: {
        categoryIds: parsed.data.categoryIds,
        maxLoad: parsed.data.maxLoad,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true, institution: true } },
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "reviewer.update",
      entity: "EventRole",
      entityId: updated.id,
      before: { categoryIds: role.categoryIds, maxLoad: role.maxLoad },
      after: { categoryIds: updated.categoryIds, maxLoad: updated.maxLoad },
    });

    return ok({
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      fullName: updated.user.fullName,
      institution: updated.user.institution,
      categoryIds: updated.categoryIds,
      maxLoad: updated.maxLoad,
      invitationStatus: updated.invitationStatus,
      confidentialityAgreedAt: updated.confidentialityAgreedAt
        ? updated.confidentialityAgreedAt.toISOString()
        : null,
    });
  } catch (error) {
    console.error("PATCH /events/:id/reviewers/:reviewerId", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, reviewerId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const role = await findReviewerRole(eventId, reviewerId);
    if (!role) return notFound("Reviewer not found");

    // Check if there are completed reviews
    const completedCount = await prisma.reviewAssignment.count({
      where: {
        eventId,
        reviewerId: role.userId,
        status: ReviewAssignmentStatus.COMPLETED,
      },
    });

    if (completedCount > 0) {
      return badRequest(
        `Cannot remove reviewer who has already submitted ${completedCount} completed review(s).`,
      );
    }

    // Delete pending/in-progress assignments and the role
    await prisma.$transaction(async (tx) => {
      await tx.reviewAssignment.deleteMany({
        where: { eventId, reviewerId: role.userId },
      });
      await tx.eventRole.delete({ where: { id: role.id } });
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "reviewer.delete",
      entity: "EventRole",
      entityId: role.id,
      before: { email: role.user.email, role: role.role },
    });

    return ok({ success: true, message: "Reviewer removed successfully" });
  } catch (error) {
    console.error("DELETE /events/:id/reviewers/:reviewerId", error);
    return serverError();
  }
}

