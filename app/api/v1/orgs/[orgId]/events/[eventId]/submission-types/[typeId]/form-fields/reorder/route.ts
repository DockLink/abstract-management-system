import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, notFound, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { reorderFormFieldsSchema } from "@/lib/validators/submissions";
import { writeAuditLog } from "@/lib/services/events/audit";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; typeId: string }>;
};

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
    const parsed = parseBody(reorderFormFieldsSchema, json);
    if (!parsed.success) return parsed.response;

    const { orderedIds } = parsed.data;

    // Update sortOrder for each field
    await Promise.all(
      orderedIds.map((id, index) =>
        prisma.formField.updateMany({
          where: { id, submissionTypeId: typeId, eventId, orgId },
          data: { sortOrder: index },
        }),
      ),
    );

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "form_field.reorder",
      entity: "SubmissionType",
      entityId: typeId,
      after: { orderedIds },
    });

    const fields = await prisma.formField.findMany({
      where: { submissionTypeId: typeId, eventId, orgId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true },
    });

    return ok(fields);
  } catch (error) {
    console.error("POST /form-fields/reorder", error);
    return serverError();
  }
}

