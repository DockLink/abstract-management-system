import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, forbidden, notFound, serverError, unprocessable } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { updateAffiliationSchema } from "@/lib/validators/submissions";
import { serializeAffiliation } from "@/lib/services/submissions/serialize";

type Ctx = { params: Promise<{ orgId: string; eventId: string; submissionId: string; affiliationId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { orgId, eventId, submissionId, affiliationId } = await routeParams(context);

    const sub = await prisma.submission.findFirst({
      where: { id: submissionId, eventId, orgId, deletedAt: null },
      select: { submitterId: true, status: true },
    });
    if (!sub) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isOwner = sub.submitterId === auth.ctx.user.id;
    if (!adminAccess.ok && !isOwner) return forbidden("Access denied");
    if (!adminAccess.ok && !["DRAFT", "REVISIONS_REQUESTED"].includes(sub.status)) {
      return unprocessable("Cannot modify affiliations in current submission status");
    }

    const affiliation = await prisma.submissionAffiliation.findFirst({ where: { id: affiliationId, submissionId } });
    if (!affiliation) return notFound("Affiliation not found");

    const json = await request.json();
    const parsed = parseBody(updateAffiliationSchema, json);
    if (!parsed.success) return parsed.response;

    const updated = await prisma.submissionAffiliation.update({
      where: { id: affiliationId },
      data: {
        number: parsed.data.number ?? undefined,
        text: parsed.data.text ?? undefined,
      },
    });

    return ok(serializeAffiliation(updated));
  } catch (error) {
    console.error("PATCH /affiliations/:id", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { orgId, eventId, submissionId, affiliationId } = await routeParams(context);

    const sub = await prisma.submission.findFirst({
      where: { id: submissionId, eventId, orgId, deletedAt: null },
      select: { submitterId: true, status: true },
    });
    if (!sub) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isOwner = sub.submitterId === auth.ctx.user.id;
    if (!adminAccess.ok && !isOwner) return forbidden("Access denied");
    if (!adminAccess.ok && !["DRAFT", "REVISIONS_REQUESTED"].includes(sub.status)) {
      return unprocessable("Cannot modify affiliations in current submission status");
    }

    const affiliation = await prisma.submissionAffiliation.findFirst({ where: { id: affiliationId, submissionId } });
    if (!affiliation) return notFound("Affiliation not found");

    await prisma.submissionAffiliation.delete({ where: { id: affiliationId } });

    return ok({ deleted: true });
  } catch (error) {
    console.error("DELETE /affiliations/:id", error);
    return serverError();
  }
}
