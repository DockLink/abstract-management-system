import { Prisma } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { conflict, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin, requireOrgAccess } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeEvent } from "@/lib/services/events/serialize";
import { updateEventSchema } from "@/lib/validators/events";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireOrgAccess(auth.ctx, orgId);
    if (!access.ok) return access.response;

    const event = await prisma.event.findFirst({
      where: { id: eventId, orgId, deletedAt: null },
    });
    if (!event) return notFound("Event not found");

    return ok(serializeEvent(event));
  } catch (error) {
    console.error("GET /events/:id", error);
    return serverError();
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(updateEventSchema, json);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;
    const before = serializeEvent(access.event);

    try {
      const event = await prisma.event.update({
        where: { id: eventId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.slug !== undefined ? { slug: body.slug } : {}),
          ...(body.edition !== undefined ? { edition: body.edition } : {}),
          ...(body.venue !== undefined ? { venue: body.venue } : {}),
          ...(body.startsAt !== undefined ? { startsAt: body.startsAt } : {}),
          ...(body.endsAt !== undefined ? { endsAt: body.endsAt } : {}),
          ...(body.contactEmail !== undefined
            ? { contactEmail: body.contactEmail }
            : {}),
          ...(body.contactPhone !== undefined
            ? { contactPhone: body.contactPhone }
            : {}),
          ...(body.guidelinesRichText !== undefined
            ? { guidelinesRichText: body.guidelinesRichText }
            : {}),
          ...(body.primaryColor !== undefined
            ? { primaryColor: body.primaryColor }
            : {}),
          ...(body.blindMode !== undefined ? { blindMode: body.blindMode } : {}),
          ...(body.settings !== undefined
            ? { settings: body.settings as Prisma.InputJsonValue }
            : {}),
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

      await writeAuditLog({
        orgId,
        eventId,
        actorId: auth.ctx.user.id,
        action: "event.update",
        entity: "Event",
        entityId: eventId,
        before,
        after: serializeEvent(event),
      });

      return ok(serializeEvent(event));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return conflict("An event with this slug already exists in the organisation");
      }
      throw error;
    }
  } catch (error) {
    console.error("PATCH /events/:id", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "event.delete",
      entity: "Event",
      entityId: eventId,
      before: serializeEvent(access.event),
    });

    return ok({ id: event.id, deleted: true });
  } catch (error) {
    console.error("DELETE /events/:id", error);
    return serverError();
  }
}
