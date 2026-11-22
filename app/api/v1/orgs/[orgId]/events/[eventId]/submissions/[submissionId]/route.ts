import { type Prisma } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, forbidden, notFound, serverError, unprocessable } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { updateSubmissionSchema, adminPatchSubmissionSchema } from "@/lib/validators/submissions";
import { serializeSubmission } from "@/lib/services/submissions/serialize";
import { snapshotSubmission } from "@/lib/services/submissions/snapshot";
import { writeAuditLog } from "@/lib/services/events/audit";
import { derivePortalState } from "@/lib/services/events/portal-state";
import { countAbstractBodyWords } from "@/lib/html";

type Ctx = { params: Promise<{ orgId: string; eventId: string; submissionId: string }> };

async function getSubmission(orgId: string, eventId: string, submissionId: string) {
  return prisma.submission.findFirst({
    where: { id: submissionId, eventId, orgId, deletedAt: null },
    include: {
      authors: { orderBy: { sortOrder: "asc" } },
      affiliations: { orderBy: { number: "asc" } },
      reviewAssignments: {
        where: { status: "COMPLETED" },
        include: { review: { select: { commentAuthor: true, isDraft: true } } },
      },
    },
  });
}

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, submissionId } = await routeParams(context);
    const submission = await getSubmission(orgId, eventId, submissionId);
    if (!submission) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isOwner = submission.submitterId === auth.ctx.user.id;

    if (!adminAccess.ok && !isOwner) {
      return forbidden("You do not have access to this submission");
    }

    return ok(serializeSubmission(submission, { authors: submission.authors, affiliations: submission.affiliations }));
  } catch (error) {
    console.error("GET /submissions/:id", error);
    return serverError();
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, submissionId } = await routeParams(context);
    const submission = await getSubmission(orgId, eventId, submissionId);
    if (!submission) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isOwner = submission.submitterId === auth.ctx.user.id;
    const isAdmin = adminAccess.ok;

    if (!isAdmin && !isOwner) {
      return forbidden("You do not have access to this submission");
    }

    // Owners can only edit DRAFT or REVISIONS_REQUESTED
    if (!isAdmin && !["DRAFT", "REVISIONS_REQUESTED"].includes(submission.status)) {
      return unprocessable("Submission cannot be edited in its current status.");
    }

    // If not admin, check the submission window is open or active personal extension / revision deadline
    if (!isAdmin) {
      const isRevision = submission.status === "REVISIONS_REQUESTED";
      const hasValidRevisionDeadline =
        isRevision && (!submission.revisionDueAt || new Date() <= submission.revisionDueAt);

      if (!hasValidRevisionDeadline) {
        const event = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
        if (event) {
          const portal = derivePortalState(event);
          // Check for personal deadline extension
          const extension = await prisma.deadlineExtension.findFirst({
            where: { eventId, submitterUserId: auth.ctx.user.id, extendsUntil: { gt: new Date() } },
          });
          if (!portal.canSubmit && !extension) {
            return unprocessable("The submission deadline has passed.");
          }
        }
      }
    }

    const json = await request.json();

    // Admin patch has different schema (can change status)
    if (isAdmin && json.status) {
      const adminParsed = parseBody(adminPatchSubmissionSchema, json);
      if (!adminParsed.success) return adminParsed.response;

      const before = serializeSubmission(submission, {});
      const updated = await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: adminParsed.data.status,
          categoryId: adminParsed.data.categoryId ?? undefined,
          preferredPresentationType: adminParsed.data.preferredPresentationType ?? undefined,
        },
        include: { authors: true, affiliations: true },
      });

      await writeAuditLog({
        orgId, eventId, actorId: auth.ctx.user.id,
        action: "submission.admin_patch",
        entity: "Submission", entityId: submissionId,
        before, after: serializeSubmission(updated, {}),
      });

      return ok(serializeSubmission(updated, { authors: updated.authors, affiliations: updated.affiliations }));
    }

    // Regular update
    const parsed = parseBody(updateSubmissionSchema, json);
    if (!parsed.success) return parsed.response;

    // Snapshot before edit
    await snapshotSubmission(submissionId, auth.ctx.user.id);

    const data = parsed.data;
    const computedWordCount = data.abstractBody
      ? countAbstractBodyWords(data.abstractBody)
      : data.wordCount;

    const updated = (await prisma.submission.update({
      where: { id: submissionId },
      data: {
        title: data.title ?? undefined,
        categoryId: data.categoryId ?? undefined,
        preferredPresentationType: data.preferredPresentationType ?? undefined,
        abstractBody: (data.abstractBody as Prisma.InputJsonValue) ?? undefined,
        keywords: data.keywords ?? undefined,
        wordCount: computedWordCount ?? undefined,
        customFieldValues: (data.customFieldValues as Prisma.InputJsonValue) ?? undefined,
        ercStatus: data.ercStatus ?? undefined,
        ercInstitution: data.ercInstitution ?? undefined,
        ercRefNo: data.ercRefNo ?? undefined,
        declarations: (data.declarations as Prisma.InputJsonValue) ?? undefined,
        prevPublishedDetails: data.prevPublishedDetails ?? undefined,
      },
      include: {
        authors: { orderBy: { sortOrder: "asc" } },
        affiliations: { orderBy: { number: "asc" } },
      },
    })) as Awaited<ReturnType<typeof prisma.submission.findFirst>> & {
      authors: NonNullable<Awaited<ReturnType<typeof prisma.submissionAuthor.findMany>>>;
      affiliations: NonNullable<Awaited<ReturnType<typeof prisma.submissionAffiliation.findMany>>>;
    };

    await writeAuditLog({
      orgId, eventId, actorId: auth.ctx.user.id,
      action: "submission.update",
      entity: "Submission", entityId: submissionId,
      after: { id: submissionId, title: updated.title },
    });

    return ok(serializeSubmission(updated, { authors: updated.authors, affiliations: updated.affiliations }));
  } catch (error) {
    console.error("PATCH /submissions/:id", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, submissionId } = await routeParams(context);

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!adminAccess.ok) return adminAccess.response;

    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, eventId, orgId, deletedAt: null },
    });
    if (!submission) return notFound("Submission not found");

    await prisma.submission.update({
      where: { id: submissionId },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog({
      orgId, eventId, actorId: auth.ctx.user.id,
      action: "submission.delete",
      entity: "Submission", entityId: submissionId,
    });

    return ok({ deleted: true });
  } catch (error) {
    console.error("DELETE /submissions/:id", error);
    return serverError();
  }
}
