import { EventRoleType } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/services/events/audit";
import { runAutoAssign } from "@/lib/services/reviews/auto-assign";
import { autoAssignSchema } from "@/lib/validators/reviews";

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

    const json = await request.json().catch(() => ({}));
    const parsed = parseBody(autoAssignSchema, json);
    if (!parsed.success) return parsed.response;

    const result = await runAutoAssign({
      orgId,
      eventId,
      reviewersPerAbstract: parsed.data.reviewersPerAbstract,
      categoryId: parsed.data.categoryId,
      balanceLoad: parsed.data.balanceLoad,
      skipSameInstitution: parsed.data.skipSameInstitution,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "review_assignment.auto_assign",
      entity: "ReviewAssignment",
      after: {
        reviewersPerAbstract: parsed.data.reviewersPerAbstract,
        categoryId: parsed.data.categoryId,
        assignmentsCreated: result.assignmentsCreated,
        totalSubmissionsProcessed: result.totalSubmissionsProcessed,
        skippedSameInstitutionCount: result.skippedSameInstitutionCount,
      },
    });

    return ok({
      success: true,
      ...result,
      message: `Auto-assignment completed: created ${result.assignmentsCreated} assignments across ${result.totalSubmissionsProcessed} submissions.`,
    });
  } catch (error) {
    console.error("POST /reviews/assignments/auto-assign", error);
    return serverError();
  }
}

