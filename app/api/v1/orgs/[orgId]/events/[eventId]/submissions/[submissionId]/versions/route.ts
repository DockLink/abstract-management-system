import { routeParams } from "@/lib/api/params";
import { ok, forbidden, notFound, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

type Ctx = { params: Promise<{ orgId: string; eventId: string; submissionId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, submissionId } = await routeParams(context);

    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, eventId, orgId, deletedAt: null },
      select: { submitterId: true },
    });
    if (!submission) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isOwner = submission.submitterId === auth.ctx.user.id;

    if (!adminAccess.ok && !isOwner) {
      return forbidden("You do not have access to this submission");
    }

    const versions = await prisma.submissionVersion.findMany({
      where: { submissionId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        content: true,
        createdById: true,
        createdAt: true,
      },
    });

    return ok(versions.map((v) => ({
      id: v.id,
      version: v.version,
      content: v.content,
      createdById: v.createdById,
      createdAt: v.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error("GET /submissions/:id/versions", error);
    return serverError();
  }
}
