import { routeParams } from "@/lib/api/params";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireOrgAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { serializeMembership } from "@/lib/services/orgs/serialize";

type Ctx = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId } = await routeParams(context);
    const access = await requireOrgAdmin(auth.ctx, orgId);
    if (!access.ok) return access.response;

    const members = await prisma.orgMembership.findMany({
      where: { orgId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return ok(members.map(serializeMembership));
  } catch (error) {
    console.error("GET /orgs/:orgId/members", error);
    return serverError();
  }
}
