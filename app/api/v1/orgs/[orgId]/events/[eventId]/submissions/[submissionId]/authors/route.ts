import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, forbidden, notFound, serverError, unprocessable } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { authorSchema } from "@/lib/validators/submissions";
import { serializeAuthor } from "@/lib/services/submissions/serialize";
import { writeAuditLog } from "@/lib/services/events/audit";

type Ctx = { params: Promise<{ orgId: string; eventId: string; submissionId: string }> };

async function getSubmissionAccess(orgId: string, eventId: string, submissionId: string, userId: string) {
  const sub = await prisma.submission.findFirst({
    where: { id: submissionId, eventId, orgId, deletedAt: null },
    select: { submitterId: true, status: true },
  });
  if (!sub) return { found: false as const };
  return { found: true as const, isOwner: sub.submitterId === userId, status: sub.status };
}

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { orgId, eventId, submissionId } = await routeParams(context);

    const access = await getSubmissionAccess(orgId, eventId, submissionId, auth.ctx.user.id);
    if (!access.found) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!adminAccess.ok && !access.isOwner) return forbidden("Access denied");

    const authors = await prisma.submissionAuthor.findMany({
      where: { submissionId },
      orderBy: { sortOrder: "asc" },
    });

    return ok(authors.map(serializeAuthor));
  } catch (error) {
    console.error("GET /authors", error);
    return serverError();
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { orgId, eventId, submissionId } = await routeParams(context);

    const access = await getSubmissionAccess(orgId, eventId, submissionId, auth.ctx.user.id);
    if (!access.found) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isAdmin = adminAccess.ok;

    if (!isAdmin && !access.isOwner) return forbidden("Access denied");
    if (!isAdmin && !["DRAFT", "REVISIONS_REQUESTED"].includes(access.status)) {
      return unprocessable("Cannot modify authors in current submission status");
    }

    const json = await request.json();
    const parsed = parseBody(authorSchema, json);
    if (!parsed.success) return parsed.response;

    // If isPresenting, unset other presenting authors
    if (parsed.data.isPresenting) {
      await prisma.submissionAuthor.updateMany({
        where: { submissionId, isPresenting: true },
        data: { isPresenting: false },
      });
    }
    // If isCorresponding, unset others
    if (parsed.data.isCorresponding) {
      await prisma.submissionAuthor.updateMany({
        where: { submissionId, isCorresponding: true },
        data: { isCorresponding: false },
      });
    }

    const count = await prisma.submissionAuthor.count({ where: { submissionId } });
    const author = await prisma.submissionAuthor.create({
      data: {
        submissionId,
        surname: parsed.data.surname,
        initials: parsed.data.initials,
        email: parsed.data.email,
        institution: parsed.data.institution ?? null,
        designation: parsed.data.designation ?? null,
        slmcNo: parsed.data.slmcNo ?? null,
        membershipNo: parsed.data.membershipNo ?? null,
        affiliationNos: parsed.data.affiliationNos ?? [],
        isPresenting: parsed.data.isPresenting ?? false,
        isCorresponding: parsed.data.isCorresponding ?? false,
        sortOrder: parsed.data.sortOrder ?? count,
      },
    });

    await writeAuditLog({
      orgId, eventId, actorId: auth.ctx.user.id,
      action: "author.create", entity: "SubmissionAuthor", entityId: author.id,
      after: serializeAuthor(author),
    });

    return ok(serializeAuthor(author), 201);
  } catch (error) {
    console.error("POST /authors", error);
    return serverError();
  }
}
