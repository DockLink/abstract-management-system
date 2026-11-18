import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, forbidden, notFound, serverError, unprocessable } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { affiliationSchema } from "@/lib/validators/submissions";
import { serializeAffiliation } from "@/lib/services/submissions/serialize";

type Ctx = { params: Promise<{ orgId: string; eventId: string; submissionId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { orgId, eventId, submissionId } = await routeParams(context);

    const sub = await prisma.submission.findFirst({
      where: { id: submissionId, eventId, orgId, deletedAt: null },
      select: { submitterId: true },
    });
    if (!sub) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!adminAccess.ok && sub.submitterId !== auth.ctx.user.id) return forbidden("Access denied");

    const affiliations = await prisma.submissionAffiliation.findMany({
      where: { submissionId },
      orderBy: { number: "asc" },
    });

    return ok(affiliations.map(serializeAffiliation));
  } catch (error) {
    console.error("GET /affiliations", error);
    return serverError();
  }
}

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
      return unprocessable("Cannot modify affiliations in current submission status");
    }

    const json = await request.json();
    const parsed = parseBody(affiliationSchema, json);
    if (!parsed.success) return parsed.response;

    const affiliation = await prisma.submissionAffiliation.upsert({
      where: { submissionId_number: { submissionId, number: parsed.data.number } },
      create: { submissionId, number: parsed.data.number, text: parsed.data.text },
      update: { text: parsed.data.text },
    });

    return ok(serializeAffiliation(affiliation), 201);
  } catch (error) {
    console.error("POST /affiliations", error);
    return serverError();
  }
}
