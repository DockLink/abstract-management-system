import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, notFound, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { updateFormFieldSchema } from "@/lib/validators/submissions";
import { writeAuditLog } from "@/lib/services/events/audit";
import type { Prisma } from "@/app/generated/prisma/client";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; typeId: string; fieldId: string }>;
};

function serializeFormField(f: {
  id: string;
  orgId: string;
  eventId: string;
  submissionTypeId: string;
  label: string;
  type: string;
  options: unknown;
  required: boolean;
  helpText: string | null;
  sortOrder: number;
  condition: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: f.id,
    orgId: f.orgId,
    eventId: f.eventId,
    submissionTypeId: f.submissionTypeId,
    label: f.label,
    type: f.type,
    options: f.options,
    required: f.required,
    helpText: f.helpText,
    sortOrder: f.sortOrder,
    condition: f.condition,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

export async function GET(request: Request, context: Ctx) {
  try {
    const { orgId, eventId, typeId, fieldId } = await routeParams(context);

    const field = await prisma.formField.findFirst({
      where: { id: fieldId, submissionTypeId: typeId, eventId, orgId },
    });
    if (!field) return notFound("Form field not found");

    return ok(serializeFormField(field));
  } catch (error) {
    console.error("GET /form-fields/:id", error);
    return serverError();
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, typeId, fieldId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const field = await prisma.formField.findFirst({
      where: { id: fieldId, submissionTypeId: typeId, eventId, orgId },
    });
    if (!field) return notFound("Form field not found");

    const json = await request.json();
    const parsed = parseBody(updateFormFieldSchema, json);
    if (!parsed.success) return parsed.response;

    const data = parsed.data;

    const updated = await prisma.formField.update({
      where: { id: fieldId },
      data: {
        label: data.label ?? undefined,
        type: data.type ?? undefined,
        options: data.options !== undefined ? (data.options as Prisma.InputJsonValue) : undefined,
        required: data.required ?? undefined,
        helpText: data.helpText !== undefined ? data.helpText : undefined,
        sortOrder: data.sortOrder ?? undefined,
        condition: data.condition !== undefined ? (data.condition as Prisma.InputJsonValue) : undefined,
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "form_field.update",
      entity: "FormField",
      entityId: fieldId,
      before: serializeFormField(field),
      after: serializeFormField(updated),
    });

    return ok(serializeFormField(updated));
  } catch (error) {
    console.error("PATCH /form-fields/:id", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, typeId, fieldId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const field = await prisma.formField.findFirst({
      where: { id: fieldId, submissionTypeId: typeId, eventId, orgId },
    });
    if (!field) return notFound("Form field not found");

    await prisma.formField.delete({
      where: { id: fieldId },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "form_field.delete",
      entity: "FormField",
      entityId: fieldId,
      before: serializeFormField(field),
    });

    return ok({ deleted: true });
  } catch (error) {
    console.error("DELETE /form-fields/:id", error);
    return serverError();
  }
}

