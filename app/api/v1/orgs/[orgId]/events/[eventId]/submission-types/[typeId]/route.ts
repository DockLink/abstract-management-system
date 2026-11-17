import { Prisma } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { updateSubmissionTypeSchema } from "@/lib/validators/events";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; typeId: string }>;
};

function serializeType(t: {
  id: string;
  orgId: string;
  eventId: string;
  name: string;
  wordLimit: number;
  sections: unknown;
  requiresErc: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    orgId: t.orgId,
    eventId: t.eventId,
    name: t.name,
    wordLimit: t.wordLimit,
    sections: t.sections,
    requiresErc: t.requiresErc,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, typeId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const existing = await prisma.submissionType.findFirst({
      where: { id: typeId, eventId, orgId },
    });
    if (!existing) return notFound("Submission type not found");

    const json = await request.json();
    const parsed = parseBody(updateSubmissionTypeSchema, json);
    if (!parsed.success) return parsed.response;

    const type = await prisma.submissionType.update({
      where: { id: typeId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.wordLimit !== undefined
          ? { wordLimit: parsed.data.wordLimit }
          : {}),
        ...(parsed.data.sections !== undefined
          ? { sections: parsed.data.sections as Prisma.InputJsonValue }
          : {}),
        ...(parsed.data.requiresErc !== undefined
          ? { requiresErc: parsed.data.requiresErc }
          : {}),
        ...(parsed.data.sortOrder !== undefined
          ? { sortOrder: parsed.data.sortOrder }
          : {}),
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "submission_type.update",
      entity: "SubmissionType",
      entityId: typeId,
      before: serializeType(existing),
      after: serializeType(type),
    });

    return ok(serializeType(type));
  } catch (error) {
    console.error("PATCH /submission-types/:id", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, typeId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const existing = await prisma.submissionType.findFirst({
      where: { id: typeId, eventId, orgId },
    });
    if (!existing) return notFound("Submission type not found");

    await prisma.submissionType.delete({ where: { id: typeId } });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "submission_type.delete",
      entity: "SubmissionType",
      entityId: typeId,
      before: serializeType(existing),
    });

    return ok({ id: typeId, deleted: true });
  } catch (error) {
    console.error("DELETE /submission-types/:id", error);
    return serverError();
  }
}
