import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { previewOrApplyCutoffs } from "@/lib/services/decisions/cutoffs";
import { writeAuditLog } from "@/lib/services/events/audit";
import { applyCutoffsSchema } from "@/lib/validators/decisions";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const admin = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!admin.ok) return admin.response;

    const json = await request.json();
    const parsed = parseBody(applyCutoffsSchema, json);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    const result = await previewOrApplyCutoffs(
      orgId,
      eventId,
      body.mode,
      body.categoryId,
      auth.ctx.user.id,
    );

    if (body.mode === "apply") {
      await writeAuditLog({
        orgId,
        eventId,
        actorId: auth.ctx.user.id,
        action: "decisions.apply_cutoffs",
        entity: "Event",
        entityId: eventId,
        after: {
          categoryId: body.categoryId ?? "ALL",
          summary: result.summary,
        },
      });
    }

    return ok(result);
  } catch (error) {
    console.error("POST /decisions/cutoffs error", error);
    return serverError();
  }
}

