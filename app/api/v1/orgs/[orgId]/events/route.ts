import { Prisma } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import {
  conflict,
  ok,
  serverError,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireOrgAccess, requireOrgAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { eventSeedNestedCreate } from "@/lib/services/events/defaults";
import { serializeEvent } from "@/lib/services/events/serialize";
import { writeAuditLog } from "@/lib/services/events/audit";
import { createEventSchema } from "@/lib/validators/events";

type Ctx = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId } = await routeParams(context);
    const access = await requireOrgAccess(auth.ctx, orgId);
    if (!access.ok) return access.response;

    const events = await prisma.event.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return ok(events.map(serializeEvent));
  } catch (error) {
    console.error("GET /events", error);
    return serverError();
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId } = await routeParams(context);
    const access = await requireOrgAdmin(auth.ctx, orgId);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(createEventSchema, json);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    try {
      const event = await prisma.event.create({
        data: {
          orgId,
          name: body.name,
          slug: body.slug,
          edition: body.edition ?? null,
          venue: body.venue ?? null,
          startsAt: body.startsAt ?? null,
          endsAt: body.endsAt ?? null,
          contactEmail: body.contactEmail ?? null,
          contactPhone: body.contactPhone ?? null,
          guidelinesRichText: body.guidelinesRichText ?? null,
          primaryColor: body.primaryColor ?? null,
          blindMode: body.blindMode ?? "DOUBLE",
          settings: (body.settings ?? {}) as Prisma.InputJsonValue,
          submissionOpenAt: body.submissionOpenAt ?? null,
          submissionCloseAt: body.submissionCloseAt ?? null,
          reviewDeadlineAt: body.reviewDeadlineAt ?? null,
          notificationAt: body.notificationAt ?? null,
          earlyBirdEndAt: body.earlyBirdEndAt ?? null,
          registrationCloseAt: body.registrationCloseAt ?? null,
          ...eventSeedNestedCreate(orgId),
        },
      });

      await writeAuditLog({
        orgId,
        eventId: event.id,
        actorId: auth.ctx.user.id,
        action: "event.create",
        entity: "Event",
        entityId: event.id,
        after: { id: event.id, slug: event.slug, name: event.name },
      });

      return ok(serializeEvent(event), 201);
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
    console.error("POST /events", error);
    return serverError();
  }
}
