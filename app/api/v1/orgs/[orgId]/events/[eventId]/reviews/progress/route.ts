import { EventRoleType } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { getReviewProgress } from "@/lib/services/reviews/stats";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const progress = await getReviewProgress(orgId, eventId);
    return ok(progress);
  } catch (error) {
    console.error("GET /reviews/progress", error);
    return serverError();
  }
}

