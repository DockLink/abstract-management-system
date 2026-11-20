import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { respondToSlot } from "@/lib/services/decisions/slots";
import { slotResponseSchema } from "@/lib/validators/decisions";
import { writeAuditLog } from "@/lib/services/events/audit";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; submissionId: string }>;
};

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, submissionId } = await routeParams(context);

    const json = await request.json();
    const parsed = parseBody(slotResponseSchema, json);
    if (!parsed.success) return parsed.response;

    const { response, reason } = parsed.data;

    try {
      const result = await respondToSlot(
        submissionId,
        auth.ctx.user.id,
        response,
        reason,
      );

      await writeAuditLog({
        orgId,
        eventId,
        actorId: auth.ctx.user.id,
        action: response === "CONFIRMED" ? "slot.confirm" : "slot.decline",
        entity: "Submission",
        entityId: submissionId,
        after: { response, reason: reason ?? null, newStatus: result.status },
      });

      return ok(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to respond to slot";
      return badRequest(msg);
    }
  } catch (error) {
    console.error("POST /submissions/[submissionId]/slot error", error);
    return serverError();
  }
}

