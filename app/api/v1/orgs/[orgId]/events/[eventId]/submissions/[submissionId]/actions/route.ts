import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, badRequest, forbidden, notFound, serverError, unprocessable } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { serializeSubmission } from "@/lib/services/submissions/serialize";
import { snapshotSubmission } from "@/lib/services/submissions/snapshot";
import { generateRefNo } from "@/lib/services/submissions/ref-no";
import { writeAuditLog } from "@/lib/services/events/audit";
import { derivePortalState } from "@/lib/services/events/portal-state";
import { countAbstractBodyWords, validateAbstractHtml } from "@/lib/html";
import { checkSubmissionEligibility } from "@/lib/services/submissions/eligibility";
import { sendSubmissionNotifications } from "@/lib/services/submissions/notifications";

type Ctx = { params: Promise<{ orgId: string; eventId: string; submissionId: string }> };

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("withdraw") }),
]);

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, submissionId } = await routeParams(context);

    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, eventId, orgId, deletedAt: null },
      include: {
        authors: { orderBy: { sortOrder: "asc" } },
        affiliations: { orderBy: { number: "asc" } },
        submissionType: true,
      },
    });
    if (!submission) return notFound("Submission not found");

    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isAdmin = adminAccess.ok;
    const isOwner = submission.submitterId === auth.ctx.user.id;

    if (!isAdmin && !isOwner) {
      return forbidden("You do not have access to this submission");
    }

    const json = await request.json();
    const parsed = parseBody(actionSchema, json);
    if (!parsed.success) return parsed.response;

    const action = parsed.data.action;

    if (action === "submit") {
      // Can only submit from DRAFT or REVISIONS_REQUESTED
      if (!["DRAFT", "REVISIONS_REQUESTED"].includes(submission.status)) {
        return unprocessable(`Cannot submit a submission in status: ${submission.status}`);
      }

      // Non-admin: check submission window, personal extension, or active revision deadline
      if (!isAdmin) {
        const isRevision = submission.status === "REVISIONS_REQUESTED";
        const hasValidRevisionDeadline =
          isRevision && (!submission.revisionDueAt || new Date() <= submission.revisionDueAt);

        if (!hasValidRevisionDeadline) {
          const event = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
          if (event) {
            const portal = derivePortalState(event);
            const extension = await prisma.deadlineExtension.findFirst({
              where: { eventId, submitterUserId: auth.ctx.user.id, extendsUntil: { gt: new Date() } },
            });
            if (!portal.canSubmit && !extension) {
              return unprocessable("The submission deadline has passed.");
            }
          }
        }
      }

      // 1. Basic validation: title, category
      if (!submission.title || submission.title.trim().length === 0) {
        return unprocessable("A title is required before submitting.");
      }

      // 2. Authors validation (SUB-05): at least one author, must have presenting author and corresponding author
      if (submission.authors.length === 0) {
        return unprocessable("At least one author is required before submitting.");
      }
      const presentingAuthor = submission.authors.find((a) => a.isPresenting);
      if (!presentingAuthor) {
        return unprocessable("Please designate one presenting author before submitting.");
      }
      const correspondingAuthor = submission.authors.find((a) => a.isCorresponding);
      if (!correspondingAuthor) {
        return unprocessable("Please designate one corresponding author before submitting.");
      }

      // 3. Eligibility check (SUB-14): max abstracts per presenting author
      const eligibility = await checkSubmissionEligibility({
        eventId,
        orgId,
        submitterId: auth.ctx.user.id,
        presentingAuthorEmail: presentingAuthor.email,
        excludeSubmissionId: submission.id,
      });
      if (!eligibility.ok) {
        return unprocessable(eligibility.reason);
      }

      // 4. Abstract body validation (SUB-02 & SUB-04):
      const abstractBody = (submission.abstractBody as Record<string, string>) || {};
      for (const [sectionKey, content] of Object.entries(abstractBody)) {
        if (typeof content === "string") {
          const htmlCheck = validateAbstractHtml(content);
          if (!htmlCheck.valid) {
            return unprocessable(
              `Abstract section '${sectionKey}' contains forbidden HTML tags: ${htmlCheck.forbiddenTags.join(", ")}. Tables and images are not allowed.`,
            );
          }
        }
      }

      // 5. Word count check (SUB-03):
      const actualWordCount = countAbstractBodyWords(abstractBody);
      const wordLimit = submission.submissionType.wordLimit || 300;
      if (actualWordCount > wordLimit) {
        return unprocessable(
          `Abstract body exceeds the word limit of ${wordLimit} words. Current count: ${actualWordCount} words.`,
        );
      }

      // 6. ERC validation (SUB-08):
      if (submission.submissionType.requiresErc) {
        if (!submission.ercStatus) {
          return unprocessable("Ethical Review Committee (ERC) status is required for this submission type.");
        }
        if (submission.ercStatus === "APPROVED" || submission.ercStatus === "EXEMPT") {
          if (!submission.ercRefNo && !submission.ercFilePath) {
            return unprocessable("ERC reference number or certificate PDF upload is required.");
          }
        }
      }

      // 7. Declarations validation (SUB-09):
      const declarations = (submission.declarations as Record<string, unknown>) || {};
      if (!declarations.allAuthorsConsented) {
        return unprocessable("All authors must consent to the submission (declaration required).");
      }
      if (!declarations.noIdentifiablePatientData) {
        return unprocessable("You must confirm there is no identifiable patient data (declaration required).");
      }

      // 8. Custom Form Fields validation (SUB-01):
      const requiredFields = await prisma.formField.findMany({
        where: { submissionTypeId: submission.submissionTypeId, required: true },
      });
      const customValues = (submission.customFieldValues as Record<string, unknown>) || {};
      for (const field of requiredFields) {
        const val = customValues[field.id];
        if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
          return unprocessable(`Required field '${field.label}' must be filled.`);
        }
      }

      // 9. Generate ref no (SUB-12) if not already set
      let refNo = submission.refNo;
      if (!refNo) {
        const event = await prisma.event.findFirst({ where: { id: eventId, orgId } });
        refNo = await generateRefNo(eventId, event?.slug ?? eventId);
      }

      // 10. Snapshot before status change
      await snapshotSubmission(submissionId, auth.ctx.user.id);

      const isRevision = submission.status === "REVISIONS_REQUESTED";

      const updated = (await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "SUBMITTED",
          refNo,
          wordCount: actualWordCount,
          submittedAt: new Date(),
        },
        include: {
          authors: { orderBy: { sortOrder: "asc" } },
          affiliations: { orderBy: { number: "asc" } },
        },
      })) as Awaited<ReturnType<typeof prisma.submission.findFirst>> & {
        authors: NonNullable<Awaited<ReturnType<typeof prisma.submissionAuthor.findMany>>>;
        affiliations: NonNullable<Awaited<ReturnType<typeof prisma.submissionAffiliation.findMany>>>;
      };

      // DEC-07: Resubmitted revision returns to the same reviewers
      if (isRevision) {
        await prisma.reviewAssignment.updateMany({
          where: { submissionId, status: { not: "CONFLICT" } },
          data: { status: "IN_PROGRESS" },
        });
      }

      await writeAuditLog({
        orgId,
        eventId,
        actorId: auth.ctx.user.id,
        action: "submission.submit",
        entity: "Submission",
        entityId: submissionId,
        after: { status: "SUBMITTED", refNo, wordCount: actualWordCount },
      });

      // 11. Dispatch notifications (SUB-12 & SUB-17)
      try {
        await sendSubmissionNotifications({ submissionId });
      } catch (notifyErr) {
        console.error("Failed to send submission notifications:", notifyErr);
      }

      return ok(serializeSubmission(updated, { authors: updated.authors, affiliations: updated.affiliations }));
    }

    if (action === "withdraw") {
      // Owner can withdraw from DRAFT or SUBMITTED (before decision)
      // Admin can withdraw from any non-terminal status
      const withdrawableByOwner = ["DRAFT", "SUBMITTED"];
      const withdrawableByAdmin = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REVISIONS_REQUESTED", "WAITLISTED"];

      if (!isAdmin && !withdrawableByOwner.includes(submission.status)) {
        return unprocessable(`Cannot withdraw a submission in status: ${submission.status}`);
      }
      if (isAdmin && !withdrawableByAdmin.includes(submission.status)) {
        return unprocessable(`Cannot withdraw a submission in status: ${submission.status}`);
      }

      await snapshotSubmission(submissionId, auth.ctx.user.id);

      const updated = (await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "WITHDRAWN", withdrawnAt: new Date() },
        include: {
          authors: { orderBy: { sortOrder: "asc" } },
          affiliations: { orderBy: { number: "asc" } },
        },
      })) as Awaited<ReturnType<typeof prisma.submission.findFirst>> & {
        authors: NonNullable<Awaited<ReturnType<typeof prisma.submissionAuthor.findMany>>>;
        affiliations: NonNullable<Awaited<ReturnType<typeof prisma.submissionAffiliation.findMany>>>;
      };

      await writeAuditLog({
        orgId,
        eventId,
        actorId: auth.ctx.user.id,
        action: "submission.withdraw",
        entity: "Submission",
        entityId: submissionId,
      });

      return ok(serializeSubmission(updated, { authors: updated.authors, affiliations: updated.affiliations }));
    }

    return badRequest("Unknown action");
  } catch (error) {
    console.error("POST /submissions/:id/actions", error);
    return serverError();
  }
}
