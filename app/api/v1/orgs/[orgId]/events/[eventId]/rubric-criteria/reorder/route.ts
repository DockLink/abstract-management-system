import { EventRoleType } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { reorderRubricCriteriaSchema } from "@/lib/validators/reviews";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

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
    const parsed = parseBody(reorderRubricCriteriaSchema, json);
    if (!parsed.success) return parsed.response;

    await prisma.$transaction(
      parsed.data.criteria.map((item) =>
        prisma.rubricCriterion.updateMany({
          where: { id: item.id, orgId, eventId },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    return ok({ success: true, message: "Rubric criteria reordered successfully" });
  } catch (error) {
    console.error("POST /rubric-criteria/reorder", error);
    return serverError();
  }
}

