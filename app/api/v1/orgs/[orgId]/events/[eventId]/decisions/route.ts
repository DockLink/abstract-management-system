import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireDecisionAccess } from "@/lib/services/decisions/access";
import { setSubmissionsDecision } from "@/lib/services/decisions/decide";
import { writeAuditLog } from "@/lib/services/events/audit";
import { setDecisionsSchema } from "@/lib/validators/decisions";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireDecisionAccess(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(setDecisionsSchema, json);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    const result = await setSubmissionsDecision(
      orgId,
      eventId,
      access.access,
      auth.ctx.user.id,
      body.submissionIds,
      body.decision,
      body.note,
    );

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: result.isRecommendationOnly
        ? "submission.recommend_decision"
        : "submission.set_decision",
      entity: "Submission",
      after: {
        submissionIds: body.submissionIds,
        decision: body.decision,
        isRecommendationOnly: result.isRecommendationOnly,
      },
    });

    return ok(result);
  } catch (error) {
    console.error("POST /decisions error", error);
    return serverError();
  }
}

