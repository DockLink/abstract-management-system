import { routeParams } from "@/lib/api/params";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireDecisionAccess } from "@/lib/services/decisions/access";
import { getDecisionBoard } from "@/lib/services/decisions/board";
import { decisionBoardQuerySchema } from "@/lib/validators/decisions";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireDecisionAccess(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const parsedQuery = decisionBoardQuerySchema.safeParse(rawQuery);

    const board = await getDecisionBoard(
      orgId,
      eventId,
      parsedQuery.success ? parsedQuery.data : {},
      access.access.categoryIds,
    );

    return ok({
      ...board,
      canDecide: access.access.canDecide,
      isAdmin: access.access.isAdmin,
    });
  } catch (error) {
    console.error("GET /decisions/board error", error);
    return serverError();
  }
}

