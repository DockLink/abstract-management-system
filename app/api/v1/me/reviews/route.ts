import { unstable_rethrow } from "next/navigation";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { prisma } from "@/lib/db/prisma";
import { EventRoleType, ReviewAssignmentStatus } from "@/app/generated/prisma/client";

/**
 * GET /api/v1/me/reviews
 * Global reviewer view — list of all events where current user is a reviewer,
 * with assignment counts, deadlines, and direct links to the review portals.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const userId = auth.ctx.user.id;

    const [reviewerRoles, assignments] = await Promise.all([
      prisma.eventRole.findMany({
        where: {
          userId,
          role: EventRoleType.REVIEWER,
        },
        include: {
          event: {
            include: {
              organisation: { select: { id: true, name: true, slug: true, logoPath: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.reviewAssignment.findMany({
        where: {
          reviewerId: userId,
        },
        select: {
          id: true,
          eventId: true,
          status: true,
          dueAt: true,
        },
      }),
    ]);

    const events = reviewerRoles.map((role) => {
      const eventAssignments = assignments.filter((a) => a.eventId === role.eventId);
      const completedCount = eventAssignments.filter(
        (a) => a.status === ReviewAssignmentStatus.COMPLETED,
      ).length;
      const inProgressCount = eventAssignments.filter(
        (a) => a.status === ReviewAssignmentStatus.IN_PROGRESS,
      ).length;
      const pendingCount = eventAssignments.filter(
        (a) => a.status === ReviewAssignmentStatus.PENDING,
      ).length;
      const conflictCount = eventAssignments.filter(
        (a) => a.status === ReviewAssignmentStatus.CONFLICT,
      ).length;

      const reviewDeadline = role.event.reviewDeadlineAt;
      const daysRemaining = reviewDeadline
        ? Math.ceil((new Date(reviewDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      const isExpired = reviewDeadline ? new Date(reviewDeadline) < new Date() : false;

      return {
        roleId: role.id,
        eventId: role.eventId,
        eventName: role.event.name,
        eventSlug: role.event.slug,
        organisation: role.event.organisation,
        invitationStatus: role.invitationStatus,
        hasAgreedToConfidentiality: Boolean(role.confidentialityAgreedAt),
        confidentialityAgreedAt: role.confidentialityAgreedAt
          ? role.confidentialityAgreedAt.toISOString()
          : null,
        reviewDeadlineAt: reviewDeadline ? reviewDeadline.toISOString() : null,
        daysRemaining,
        isExpired,
        counts: {
          total: eventAssignments.length,
          completed: completedCount,
          inProgress: inProgressCount,
          pending: pendingCount,
          conflict: conflictCount,
        },
      };
    });

    return ok({ events });
  } catch (error) {
    // Let Next.js prerender-bailout signals propagate (cacheComponents).
    unstable_rethrow(error);
    console.error("GET /api/v1/me/reviews", error);
    return serverError();
  }
}

