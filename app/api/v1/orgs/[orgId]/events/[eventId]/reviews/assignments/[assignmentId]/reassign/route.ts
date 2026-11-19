import {
  EventRoleType,
  ReviewAssignmentStatus,
} from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeReviewAssignment } from "@/lib/services/reviews/serialize";
import { reassignAssignmentSchema } from "@/lib/validators/reviews";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; assignmentId: string }>;
};

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, assignmentId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const assignment = await prisma.reviewAssignment.findFirst({
      where: { id: assignmentId, orgId, eventId },
      include: {
        submission: { include: { authors: true } },
      },
    });
    if (!assignment) return notFound("Assignment not found");

    const json = await request.json();
    const parsed = parseBody(reassignAssignmentSchema, json);
    if (!parsed.success) return parsed.response;

    const { newReviewerId, dueAt, reason } = parsed.data;

    // Check new reviewer role
    const newReviewerRole = await prisma.eventRole.findFirst({
      where: {
        eventId,
        role: EventRoleType.REVIEWER,
        OR: [{ id: newReviewerId }, { userId: newReviewerId }],
      },
      include: { user: true },
    });
    if (!newReviewerRole) {
      return badRequest("New reviewer is not a registered reviewer for this event");
    }

    const targetUserId = newReviewerRole.userId;

    // Check conflict: cannot be co-author
    const isCoAuthor = assignment.submission.authors.some(
      (a) => a.email.toLowerCase() === newReviewerRole.user.email.toLowerCase(),
    );
    if (isCoAuthor) {
      return badRequest(
        `Selected reviewer (${newReviewerRole.user.email}) is an author on this submission`,
      );
    }

    // Check if new reviewer is already assigned to this submission
    const existing = await prisma.reviewAssignment.findUnique({
      where: {
        submissionId_reviewerId: {
          submissionId: assignment.submissionId,
          reviewerId: targetUserId,
        },
      },
    });
    if (existing && existing.id !== assignment.id) {
      return badRequest("Selected reviewer is already assigned to this submission");
    }

    // Reassign
    const updated = await prisma.$transaction(async (tx) => {
      // If previous assignment had a review, delete it since reviewer changed
      await tx.review.deleteMany({
        where: { assignmentId: assignment.id },
      });

      return tx.reviewAssignment.update({
        where: { id: assignment.id },
        data: {
          reviewerId: targetUserId,
          status: ReviewAssignmentStatus.PENDING,
          coiReason: null,
          dueAt: dueAt ? new Date(dueAt) : assignment.dueAt,
        },
        include: {
          reviewer: {
            select: { id: true, email: true, fullName: true, institution: true },
          },
          submission: {
            include: {
              category: { select: { id: true, name: true } },
              submissionType: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "review_assignment.reassign",
      entity: "ReviewAssignment",
      entityId: assignment.id,
      before: {
        oldReviewerId: assignment.reviewerId,
        previousStatus: assignment.status,
      },
      after: {
        newReviewerId: targetUserId,
        reason,
      },
    });

    return ok({
      success: true,
      assignment: serializeReviewAssignment(updated),
      message: "Review assignment successfully reassigned to new reviewer",
    });
  } catch (error) {
    console.error("POST /reviews/assignments/:assignmentId/reassign", error);
    return serverError();
  }
}

