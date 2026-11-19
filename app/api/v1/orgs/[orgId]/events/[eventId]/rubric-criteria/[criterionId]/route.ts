import { EventRoleType } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeRubricCriterion } from "@/lib/services/reviews/serialize";
import { updateRubricCriterionSchema } from "@/lib/validators/reviews";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; criterionId: string }>;
};

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, criterionId } = await routeParams(context);

    const criterion = await prisma.rubricCriterion.findFirst({
      where: { id: criterionId, orgId, eventId },
    });
    if (!criterion) return notFound("Rubric criterion not found");

    return ok(serializeRubricCriterion(criterion));
  } catch (error) {
    console.error("GET /rubric-criteria/:criterionId", error);
    return serverError();
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, criterionId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const criterion = await prisma.rubricCriterion.findFirst({
      where: { id: criterionId, orgId, eventId },
    });
    if (!criterion) return notFound("Rubric criterion not found");

    const json = await request.json();
    const parsed = parseBody(updateRubricCriterionSchema, json);
    if (!parsed.success) return parsed.response;

    const updated = await prisma.rubricCriterion.update({
      where: { id: criterionId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        scaleMin: parsed.data.scaleMin,
        scaleMax: parsed.data.scaleMax,
        weight: parsed.data.weight,
        sortOrder: parsed.data.sortOrder,
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "rubric_criterion.update",
      entity: "RubricCriterion",
      entityId: updated.id,
      before: serializeRubricCriterion(criterion),
      after: serializeRubricCriterion(updated),
    });

    return ok(serializeRubricCriterion(updated));
  } catch (error) {
    console.error("PATCH /rubric-criteria/:criterionId", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, criterionId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const criterion = await prisma.rubricCriterion.findFirst({
      where: { id: criterionId, orgId, eventId },
    });
    if (!criterion) return notFound("Rubric criterion not found");

    await prisma.rubricCriterion.delete({ where: { id: criterionId } });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "rubric_criterion.delete",
      entity: "RubricCriterion",
      entityId: criterion.id,
      before: serializeRubricCriterion(criterion),
    });

    return ok({ success: true, message: "Rubric criterion deleted successfully" });
  } catch (error) {
    console.error("DELETE /rubric-criteria/:criterionId", error);
    return serverError();
  }
}

