import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, forbidden, notFound, serverError, unprocessable } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { reorderAuthorsSchema } from "@/lib/validators/submissions";

type Ctx = { params: Promise<{ orgId: string; eventId: string; submissionId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { orgId, eventId, submissionId } = await routeParams(context);

    const sub = await prisma.submission.findFirst({
      where: { id: submissionId, eventId, orgId, deletedAt: null },
      select: { submitterId: true, status: true },
    });
    if (!sub) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isOwner = sub.submitterId === auth.ctx.user.id;
    if (!adminAccess.ok && !isOwner) return forbidden("Access denied");
    if (!adminAccess.ok && !["DRAFT", "REVISIONS_REQUESTED"].includes(sub.status)) {
      return unprocessable("Cannot modify authors in current submission status");
    }

    const json = await request.json();
    const parsed = parseBody(reorderAuthorsSchema, json);
    if (!parsed.success) return parsed.response;

    // Update sortOrder for each author
    await Promise.all(
      parsed.data.orderedIds.map((id, idx) =>
        prisma.submissionAuthor.updateMany({
          where: { id, submissionId },
          data: { sortOrder: idx },
        })
      )
    );

    const authors = await prisma.submissionAuthor.findMany({
      where: { submissionId },
      orderBy: { sortOrder: "asc" },
    });

    return ok(authors.map((a) => ({ id: a.id, sortOrder: a.sortOrder })));
  } catch (error) {
    console.error("POST /authors/reorder", error);
    return serverError();
  }
}
