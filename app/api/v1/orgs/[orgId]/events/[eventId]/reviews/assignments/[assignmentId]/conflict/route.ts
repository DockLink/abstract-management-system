import {
  EventRoleType,
  ReviewAssignmentStatus,
} from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { forbidden, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { declareConflictSchema } from "@/lib/validators/reviews";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; assignmentId: string }>;
};

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, assignmentId } = await routeParams(context);

    const assignment = await prisma.reviewAssignment.findFirst({
      where: { id: assignmentId, orgId, eventId },
    });
    if (!assignment) return notFound("Assignment not found");

    // Must be assigned reviewer or admin/chair
    const isOwner = assignment.reviewerId === auth.ctx.user.id;
    if (!isOwner) {
      const access = await requireEventRole(auth.ctx, orgId, eventId, [
        EventRoleType.EVENT_ADMIN,
        EventRoleType.TRACK_CHAIR,
      ]);
      if (!access.ok) {
        return forbidden("You can only declare conflict on your own assignment");
      }
    }

    const json = await request.json();
    const parsed = parseBody(declareConflictSchema, json);
    if (!parsed.success) return parsed.response;

    const updated = await prisma.reviewAssignment.update({
      where: { id: assignmentId },
      data: {
        status: ReviewAssignmentStatus.CONFLICT,
        coiReason: parsed.data.reason,
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "review_assignment.conflict_declared",
      entity: "ReviewAssignment",
      entityId: assignment.id,
      after: {
        submissionId: assignment.submissionId,
        reviewerId: assignment.reviewerId,
        reason: parsed.data.reason,
      },
    });

    return ok({
      success: true,
      status: updated.status,
      coiReason: updated.coiReason,
      message: "Conflict of interest declared. The abstract has been returned to the committee for reassignment.",
    });
  } catch (error) {
    console.error("POST /reviews/assignments/:assignmentId/conflict", error);
    return serverError();
  }
}

