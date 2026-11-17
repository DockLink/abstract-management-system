import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { conflict, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { cloneEvent } from "@/lib/services/events/clone";
import { serializeEvent } from "@/lib/services/events/serialize";
import { cloneEventSchema } from "@/lib/validators/events";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(cloneEventSchema, json);
    if (!parsed.success) return parsed.response;

    const result = await cloneEvent({
      sourceEventId: eventId,
      orgId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      edition: parsed.data.edition,
      actorId: auth.ctx.user.id,
    });

    if (!result.ok) {
      if (result.reason === "NOT_FOUND") return notFound("Event not found");
      return conflict("An event with this slug already exists in the organisation");
    }

    return ok(
      {
        event: serializeEvent(result.event),
        categories: result.event.categories,
        submissionTypes: result.event.submissionTypes,
        presentationTypes: result.event.presentationTypes,
        eligibilityRule: result.event.eligibilityRule,
      },
      201,
    );
  } catch (error) {
    console.error("POST /clone", error);
    return serverError();
  }
}
