import { EventRoleType } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { getScoresTable } from "@/lib/services/reviews/stats";
import { scoresTableQuerySchema } from "@/lib/validators/reviews";

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

    const url = new URL(request.url);
    const queryData = Object.fromEntries(url.searchParams.entries());
    const parsed = scoresTableQuerySchema.safeParse(queryData);
    const filters = parsed.success
      ? parsed.data
      : { page: 1, limit: 20, disagreementThreshold: 2.0, categoryId: undefined, search: undefined };

    const result = await getScoresTable({
      orgId,
      eventId,
      categoryId: filters.categoryId,
      disagreementThreshold: filters.disagreementThreshold,
      search: filters.search,
      page: filters.page,
      limit: filters.limit,
    });

    return ok(result);
  } catch (error) {
    console.error("GET /reviews/scores-table", error);
    return serverError();
  }
}
