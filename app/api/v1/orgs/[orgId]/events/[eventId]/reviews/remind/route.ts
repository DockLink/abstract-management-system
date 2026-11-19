import {
  EventRoleType,
  ReviewAssignmentStatus,
} from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { getEventInOrg, requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { sendReminderSchema } from "@/lib/validators/reviews";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const event = await getEventInOrg(orgId, eventId);
    if (!event) return notFound("Event not found");

    const json = await request.json().catch(() => ({}));
    const parsed = parseBody(sendReminderSchema, json);
    if (!parsed.success) return parsed.response;

    const { reviewerId, allPending, message } = parsed.data;

    if (!reviewerId && !allPending) {
      return badRequest("Provide either reviewerId or allPending: true");
    }

    // Find target reviewers with pending/in-progress assignments
    const reviewerWhere: Record<string, unknown> = {
      eventId,
      status: {
        in: [ReviewAssignmentStatus.PENDING, ReviewAssignmentStatus.IN_PROGRESS],
      },
    };

    if (reviewerId) {
      reviewerWhere.reviewerId = reviewerId;
    }

    const pendingAssignments = await prisma.reviewAssignment.findMany({
      where: reviewerWhere,
      include: {
        reviewer: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (pendingAssignments.length === 0) {
      return ok({
        remindedCount: 0,
        message: "No pending or in-progress review assignments found to remind.",
      });
    }

    // Group by reviewer
    const reviewerMap = new Map<
      string,
      { email: string; fullName: string | null; count: number }
    >();

    for (const a of pendingAssignments) {
      const existing = reviewerMap.get(a.reviewerId);
      if (existing) {
        existing.count++;
      } else {
        reviewerMap.set(a.reviewerId, {
          email: a.reviewer.email,
          fullName: a.reviewer.fullName,
          count: 1,
        });
      }
    }

    const remindedList = Array.from(reviewerMap.entries()).map(([id, info]) => ({
      reviewerId: id,
      email: info.email,
      fullName: info.fullName,
      pendingCount: info.count,
    }));

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "review.reminder_sent",
      entity: "ReviewAssignment",
      after: {
        remindedReviewersCount: remindedList.length,
        remindedReviewers: remindedList,
        customMessage: message,
      },
    });

    return ok({
      success: true,
      remindedCount: remindedList.length,
      remindedReviewers: remindedList,
      message: `Successfully sent review reminder to ${remindedList.length} reviewer(s).`,
    });
  } catch (error) {
    console.error("POST /reviews/remind", error);
    return serverError();
  }
}

