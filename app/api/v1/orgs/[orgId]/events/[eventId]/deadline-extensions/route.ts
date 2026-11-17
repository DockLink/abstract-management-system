import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { deadlineExtensionSchema } from "@/lib/validators/events";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

function serialize(ext: {
  id: string;
  orgId: string;
  eventId: string;
  submitterUserId: string;
  extendsUntil: Date;
  reason: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: ext.id,
    orgId: ext.orgId,
    eventId: ext.eventId,
    submitterUserId: ext.submitterUserId,
    extendsUntil: ext.extendsUntil.toISOString(),
    reason: ext.reason,
    createdById: ext.createdById,
    createdAt: ext.createdAt.toISOString(),
    updatedAt: ext.updatedAt.toISOString(),
  };
}

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const extensions = await prisma.deadlineExtension.findMany({
      where: { eventId, orgId },
      orderBy: { createdAt: "desc" },
    });

    return ok(extensions.map(serialize));
  } catch (error) {
    console.error("GET /deadline-extensions", error);
    return serverError();
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(deadlineExtensionSchema, json);
    if (!parsed.success) return parsed.response;

    const submitter = await prisma.user.findUnique({
      where: { id: parsed.data.submitterUserId },
    });
    if (!submitter) {
      return badRequest("submitterUserId does not match a known user");
    }

    if (parsed.data.extendsUntil <= new Date()) {
      return badRequest("extendsUntil must be in the future");
    }

    const extension = await prisma.deadlineExtension.create({
      data: {
        orgId,
        eventId,
        submitterUserId: parsed.data.submitterUserId,
        extendsUntil: parsed.data.extendsUntil,
        reason: parsed.data.reason ?? null,
        createdById: auth.ctx.user.id,
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "deadline_extension.create",
      entity: "DeadlineExtension",
      entityId: extension.id,
      after: serialize(extension),
    });

    return ok(serialize(extension), 201);
  } catch (error) {
    console.error("POST /deadline-extensions", error);
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

    const url = new URL(request.url);
    const extensionId = url.searchParams.get("id");
    if (!extensionId) return badRequest("Query param id is required");

    const existing = await prisma.deadlineExtension.findFirst({
      where: { id: extensionId, eventId, orgId },
    });
    if (!existing) return notFound("Deadline extension not found");

    await prisma.deadlineExtension.delete({ where: { id: extensionId } });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "deadline_extension.delete",
      entity: "DeadlineExtension",
      entityId: extensionId,
      before: serialize(existing),
    });

    return ok({ id: extensionId, deleted: true });
  } catch (error) {
    console.error("DELETE /deadline-extensions", error);
    return serverError();
  }
}
