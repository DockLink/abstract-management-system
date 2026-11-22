import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { releaseDecisions } from "@/lib/services/decisions/release";
import { writeAuditLog } from "@/lib/services/events/audit";
import { releaseDecisionsSchema } from "@/lib/validators/decisions";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const admin = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!admin.ok) return admin.response;

    const json = await request.json();
    const parsed = parseBody(releaseDecisionsSchema, json);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    const url = new URL(request.url);
    const appBaseUrl = `${url.protocol}//${url.host}`;

    const result = await releaseDecisions({
      ...body,
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      appBaseUrl,
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "decisions.release",
      entity: "Event",
      entityId: eventId,
      after: {
        releasedCount: result.releasedCount,
        emailsQueued: result.emailsQueued,
        categoryId: body.categoryId ?? "ALL",
        includeReviewerComments: body.includeReviewerComments,
      },
    });

    return ok(result);
  } catch (error) {
    console.error("POST /decisions/release error", error);
    return serverError();
  }
}

