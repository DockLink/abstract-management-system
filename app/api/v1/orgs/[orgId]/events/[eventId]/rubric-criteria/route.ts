import { EventRoleType } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { getEventInOrg, requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeRubricCriterion } from "@/lib/services/reviews/serialize";
import { createRubricCriterionSchema } from "@/lib/validators/reviews";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const event = await getEventInOrg(orgId, eventId);
    if (!event) return ok([]);

    const criteria = await prisma.rubricCriterion.findMany({
      where: { orgId, eventId },
      orderBy: { sortOrder: "asc" },
    });

    return ok(criteria.map(serializeRubricCriterion));
  } catch (error) {
    console.error("GET /rubric-criteria", error);
    return serverError();
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(createRubricCriterionSchema, json);
    if (!parsed.success) return parsed.response;

    // Get highest sortOrder if not provided
    let sortOrder = parsed.data.sortOrder ?? 0;
    if (parsed.data.sortOrder === undefined) {
      const last = await prisma.rubricCriterion.findFirst({
        where: { orgId, eventId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = last ? last.sortOrder + 1 : 0;
    }

    const criterion = await prisma.rubricCriterion.create({
      data: {
        orgId,
        eventId,
        name: parsed.data.name,
        description: parsed.data.description,
        scaleMin: parsed.data.scaleMin,
        scaleMax: parsed.data.scaleMax,
        weight: parsed.data.weight,
        sortOrder,
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "rubric_criterion.create",
      entity: "RubricCriterion",
      entityId: criterion.id,
      after: serializeRubricCriterion(criterion),
    });

    return ok(serializeRubricCriterion(criterion), 201);
  } catch (error) {
    console.error("POST /rubric-criteria", error);
    return serverError();
  }
}

