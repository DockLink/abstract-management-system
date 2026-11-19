import { EventRoleType, ReviewAssignmentStatus } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const [roles, categories, assignments] = await Promise.all([
      prisma.eventRole.findMany({
        where: {
          eventId,
          role: EventRoleType.REVIEWER,
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
        orderBy: { createdAt: "asc" },
      }),
      prisma.category.findMany({
        where: { orgId, eventId },
        select: { id: true, name: true },
      }),
      prisma.reviewAssignment.findMany({
        where: { orgId, eventId },
        select: { reviewerId: true, status: true },
      }),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const reviewers = roles.map((role) => {
      const userAssignments = assignments.filter((a) => a.reviewerId === role.userId);
      const completedCount = userAssignments.filter(
        (a) => a.status === ReviewAssignmentStatus.COMPLETED,
      ).length;
      const inProgressCount = userAssignments.filter(
        (a) => a.status === ReviewAssignmentStatus.IN_PROGRESS,
      ).length;
      const conflictCount = userAssignments.filter(
        (a) => a.status === ReviewAssignmentStatus.CONFLICT,
      ).length;
      const pendingCount = userAssignments.filter(
        (a) => a.status === ReviewAssignmentStatus.PENDING,
      ).length;

      const expertCategories = role.categoryIds
        .map((catId) => ({ id: catId, name: categoryMap.get(catId) ?? catId }))
        .filter((c) => categoryMap.has(c.id));

      return {
        id: role.id,
        userId: role.userId,
        email: role.user.email,
        fullName: role.user.fullName,
        institution: role.user.institution,
        categoryIds: role.categoryIds,
        categories: expertCategories,
        maxLoad: role.maxLoad ?? 20,
        invitationStatus: role.invitationStatus ?? "PENDING",
        confidentialityAgreedAt: role.confidentialityAgreedAt
          ? role.confidentialityAgreedAt.toISOString()
          : null,
        assignedCount: userAssignments.length,
        completedCount,
        inProgressCount,
        pendingCount,
        conflictCount,
        createdAt: role.createdAt.toISOString(),
      };
    });

    return ok(reviewers);
  } catch (error) {
    console.error("GET /events/:id/reviewers", error);
    return serverError();
  }
}

