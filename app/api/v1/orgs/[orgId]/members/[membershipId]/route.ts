import { OrgRole } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import {
  notFound,
  ok,
  serverError,
  unprocessable,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireOrgAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeMembership } from "@/lib/services/orgs/serialize";

type Ctx = { params: Promise<{ orgId: string; membershipId: string }> };

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, membershipId } = await routeParams(context);
    const access = await requireOrgAdmin(auth.ctx, orgId);
    if (!access.ok) return access.response;

    const membership = await prisma.orgMembership.findFirst({
      where: { id: membershipId, orgId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!membership) return notFound("Membership not found");

    if (membership.role === OrgRole.ORG_ADMIN) {
      const adminCount = await prisma.orgMembership.count({
        where: { orgId, role: OrgRole.ORG_ADMIN },
      });
      if (adminCount <= 1) {
        return unprocessable("Cannot remove the last org admin");
      }
    }

    await prisma.orgMembership.delete({ where: { id: membershipId } });

    await writeAuditLog({
      orgId,
      actorId: auth.ctx.user.id,
      action: "org.member.remove",
      entity: "OrgMembership",
      entityId: membershipId,
      before: serializeMembership(membership),
    });

    return ok({ id: membershipId, deleted: true });
  } catch (error) {
    console.error("DELETE /orgs/:orgId/members/:id", error);
    return serverError();
  }
}
