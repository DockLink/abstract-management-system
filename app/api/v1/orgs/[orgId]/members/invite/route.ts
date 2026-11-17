import { OrgRole, Prisma } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { conflict, ok, serverError } from "@/lib/api/response";
import { requireAuth, serializeAppUser } from "@/lib/auth/supabase";
import { requireOrgAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { resolveOrInviteUser } from "@/lib/services/auth/invite";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeMembership } from "@/lib/services/orgs/serialize";
import { inviteOrgMemberSchema } from "@/lib/validators/orgs";

type Ctx = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId } = await routeParams(context);
    const access = await requireOrgAdmin(auth.ctx, orgId);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(inviteOrgMemberSchema, json);
    if (!parsed.success) return parsed.response;

    const { user, invited } = await resolveOrInviteUser({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
    });

    try {
      const membership = await prisma.orgMembership.upsert({
        where: {
          orgId_userId: { orgId, userId: user.id },
        },
        create: {
          orgId,
          userId: user.id,
          role: OrgRole.ORG_ADMIN,
        },
        update: {
          role: OrgRole.ORG_ADMIN,
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      await writeAuditLog({
        orgId,
        actorId: auth.ctx.user.id,
        action: "org.member.invite",
        entity: "OrgMembership",
        entityId: membership.id,
        after: {
          ...serializeMembership(membership),
          invited,
        },
      });

      return ok(
        {
          invited,
          user: serializeAppUser(user),
          membership: serializeMembership(membership),
        },
        invited ? 201 : 200,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return conflict("User is already a member of this organisation");
      }
      throw error;
    }
  } catch (error) {
    console.error("POST /orgs/:orgId/members/invite", error);
    return serverError(
      error instanceof Error ? error.message : "Internal server error",
    );
  }
}
