import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { requireDecisionAccess } from "@/lib/services/decisions/access";
import {
  readDecisionSettings,
  writeDecisionSettings,
} from "@/lib/services/decisions/settings";
import { writeAuditLog } from "@/lib/services/events/audit";
import { updateDecisionSettingsSchema } from "@/lib/validators/decisions";
import { prisma } from "@/lib/db/prisma";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireDecisionAccess(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, settings: true, registrationCloseAt: true },
    });
    if (!event) return serverError("Event not found");

    const settings = readDecisionSettings(event);
    return ok(settings);
  } catch (error) {
    console.error("GET /decisions/settings error", error);
    return serverError();
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const admin = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!admin.ok) return admin.response;

    const json = await request.json();
    const parsed = parseBody(updateDecisionSettingsSchema, json);
    if (!parsed.success) return parsed.response;

    const prev = readDecisionSettings(admin.event);
    const updated = await writeDecisionSettings(admin.event, parsed.data);

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "event.update_decision_settings",
      entity: "Event",
      entityId: eventId,
      before: prev,
      after: updated,
    });

    return ok(updated);
  } catch (error) {
    console.error("PATCH /decisions/settings error", error);
    return serverError();
  }
}

