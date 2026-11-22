import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeEvent } from "@/lib/services/events/serialize";
import { keyDatesSchema } from "@/lib/validators/events";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    return ok(serializeEvent(access.event).keyDates);
  } catch (error) {
    console.error("GET /key-dates", error);
    return serverError();
  }
}

export async function PUT(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(keyDatesSchema, json);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;
    const before = serializeEvent(access.event).keyDates;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(body.submissionOpenAt !== undefined
          ? { submissionOpenAt: body.submissionOpenAt }
          : {}),
        ...(body.submissionCloseAt !== undefined
          ? { submissionCloseAt: body.submissionCloseAt }
          : {}),
        ...(body.reviewDeadlineAt !== undefined
          ? { reviewDeadlineAt: body.reviewDeadlineAt }
          : {}),
        ...(body.notificationAt !== undefined
          ? { notificationAt: body.notificationAt }
          : {}),
        ...(body.earlyBirdEndAt !== undefined
          ? { earlyBirdEndAt: body.earlyBirdEndAt }
          : {}),
        ...(body.registrationCloseAt !== undefined
          ? { registrationCloseAt: body.registrationCloseAt }
          : {}),
      },
    });

    const after = serializeEvent(event).keyDates;

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "event.key_dates.update",
      entity: "Event",
      entityId: eventId,
      before,
      after,
    });

    return ok(after);
  } catch (error) {
    console.error("PUT /key-dates", error);
    return serverError();
  }
}
