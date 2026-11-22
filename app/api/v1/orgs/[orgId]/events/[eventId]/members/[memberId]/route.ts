import { routeParams } from "@/lib/api/params";
import { notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; memberId: string }>;
};

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, memberId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const member = await prisma.member.findFirst({
      where: { id: memberId, orgId },
    });
    if (!member) return notFound("Member not found");

    await prisma.member.delete({ where: { id: memberId } });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "members.delete",
      entity: "Member",
      entityId: memberId,
      before: {
        id: member.id,
        name: member.name,
        membershipNo: member.membershipNo,
        email: member.email,
      },
    });

    return ok({ id: memberId, deleted: true });
  } catch (error) {
    console.error("DELETE /members/:id", error);
    return serverError();
  }
}
