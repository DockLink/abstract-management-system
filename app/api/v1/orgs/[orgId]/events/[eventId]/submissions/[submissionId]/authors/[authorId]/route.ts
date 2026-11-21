import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, forbidden, notFound, serverError, unprocessable } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { updateAuthorSchema } from "@/lib/validators/submissions";
import { serializeAuthor } from "@/lib/services/submissions/serialize";
import { writeAuditLog } from "@/lib/services/events/audit";

type Ctx = { params: Promise<{ orgId: string; eventId: string; submissionId: string; authorId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { orgId, eventId, submissionId, authorId } = await routeParams(context);

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

    const author = await prisma.submissionAuthor.findFirst({ where: { id: authorId, submissionId } });
    if (!author) return notFound("Author not found");

    const json = await request.json();
    const parsed = parseBody(updateAuthorSchema, json);
    if (!parsed.success) return parsed.response;

    if (parsed.data.isPresenting) {
      await prisma.submissionAuthor.updateMany({
        where: { submissionId, isPresenting: true, id: { not: authorId } },
        data: { isPresenting: false },
      });
    }
    if (parsed.data.isCorresponding) {
      await prisma.submissionAuthor.updateMany({
        where: { submissionId, isCorresponding: true, id: { not: authorId } },
        data: { isCorresponding: false },
      });
    }

    const updated = await prisma.submissionAuthor.update({
      where: { id: authorId },
      data: {
        surname: parsed.data.surname ?? undefined,
        initials: parsed.data.initials ?? undefined,
        email: parsed.data.email ?? undefined,
        // undefined = leave as is; null = clear the field
        institution: parsed.data.institution,
        designation: parsed.data.designation,
        slmcNo: parsed.data.slmcNo,
        membershipNo: parsed.data.membershipNo,
        affiliationNos: parsed.data.affiliationNos ?? undefined,
        isPresenting: parsed.data.isPresenting ?? undefined,
        isCorresponding: parsed.data.isCorresponding ?? undefined,
        sortOrder: parsed.data.sortOrder ?? undefined,
      },
    });

    await writeAuditLog({
      orgId, eventId, actorId: auth.ctx.user.id,
      action: "author.update", entity: "SubmissionAuthor", entityId: authorId,
    });

    return ok(serializeAuthor(updated));
  } catch (error) {
    console.error("PATCH /authors/:id", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { orgId, eventId, submissionId, authorId } = await routeParams(context);

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

    const author = await prisma.submissionAuthor.findFirst({ where: { id: authorId, submissionId } });
    if (!author) return notFound("Author not found");

    await prisma.submissionAuthor.delete({ where: { id: authorId } });

    await writeAuditLog({
      orgId, eventId, actorId: auth.ctx.user.id,
      action: "author.delete", entity: "SubmissionAuthor", entityId: authorId,
    });

    return ok({ deleted: true });
  } catch (error) {
    console.error("DELETE /authors/:id", error);
    return serverError();
  }
}
