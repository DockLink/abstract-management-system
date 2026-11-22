import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, badRequest, notFound, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { formFieldSchema } from "@/lib/validators/submissions";
import { writeAuditLog } from "@/lib/services/events/audit";
import type { Prisma } from "@/app/generated/prisma/client";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; typeId: string }>;
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
    const { orgId, eventId, typeId } = await routeParams(context);

    const submissionType = await prisma.submissionType.findFirst({
      where: { id: typeId, eventId, orgId },
    });
    if (!submissionType) return notFound("Submission type not found");

    const fields = await prisma.formField.findMany({
      where: { submissionTypeId: typeId, eventId, orgId },
      orderBy: { sortOrder: "asc" },
    });

    return ok(fields.map(serializeFormField));
  } catch (error) {
    console.error("GET /form-fields", error);
    return serverError();
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, typeId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const submissionType = await prisma.submissionType.findFirst({
      where: { id: typeId, eventId, orgId },
    });
    if (!submissionType) return notFound("Submission type not found");

    const json = await request.json();
    const parsed = parseBody(formFieldSchema, json);
    if (!parsed.success) return parsed.response;

    const data = parsed.data;

    // Default sortOrder to end if not specified
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined || sortOrder === 0) {
      const maxOrder = await prisma.formField.aggregate({
        where: { submissionTypeId: typeId },
        _max: { sortOrder: true },
      });
      sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    }

    const field = await prisma.formField.create({
      data: {
        orgId,
        eventId,
        submissionTypeId: typeId,
        label: data.label,
        type: data.type,
        options: (data.options ?? null) as Prisma.InputJsonValue,
        required: data.required ?? false,
        helpText: data.helpText ?? null,
        sortOrder,
        condition: (data.condition ?? null) as Prisma.InputJsonValue,
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "form_field.create",
      entity: "FormField",
      entityId: field.id,
      after: serializeFormField(field),
    });

    return ok(serializeFormField(field), 201);
  } catch (error) {
    console.error("POST /form-fields", error);
    return serverError();
  }
}

