import { PresentationTypeCode } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { presentationTypesSchema } from "@/lib/validators/events";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

function serialize(t: {
  id: string;
  orgId: string;
  eventId: string;
  code: PresentationTypeCode;
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    orgId: t.orgId,
    eventId: t.eventId,
    code: t.code,
    label: t.label,
    isActive: t.isActive,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const types = await prisma.presentationType.findMany({
      where: { eventId, orgId },
      orderBy: { sortOrder: "asc" },
    });

    return ok(types.map(serialize));
  } catch (error) {
    console.error("GET /presentation-types", error);
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
    const parsed = parseBody(presentationTypesSchema, json);
    if (!parsed.success) return parsed.response;

    const before = await prisma.presentationType.findMany({
      where: { eventId, orgId },
    });

    const types = await prisma.$transaction(async (tx) => {
      await tx.presentationType.deleteMany({ where: { eventId, orgId } });
      await tx.presentationType.createMany({
        data: parsed.data.types.map((t, index) => ({
          orgId,
          eventId,
          code: t.code as PresentationTypeCode,
          label: t.label,
          isActive: t.isActive ?? true,
          sortOrder: t.sortOrder ?? index,
        })),
      });
      return tx.presentationType.findMany({
        where: { eventId, orgId },
        orderBy: { sortOrder: "asc" },
      });
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "presentation_types.replace",
      entity: "PresentationType",
      entityId: eventId,
      before: before.map(serialize),
      after: types.map(serialize),
    });

    return ok(types.map(serialize));
  } catch (error) {
    console.error("PUT /presentation-types", error);
    return serverError();
  }
}
