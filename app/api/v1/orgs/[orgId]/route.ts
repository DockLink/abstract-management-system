import { routeParams } from "@/lib/api/params";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireOrgAccess } from "@/lib/auth/rbac";
import { serializeOrg } from "@/lib/services/orgs/serialize";

type Ctx = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId } = await routeParams(context);
    const access = await requireOrgAccess(auth.ctx, orgId);
    if (!access.ok) return access.response;

    return ok(serializeOrg(access.org));
  } catch (error) {
    console.error("GET /orgs/:orgId", error);
    return serverError();
  }
}
