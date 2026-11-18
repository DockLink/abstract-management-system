import { type Prisma, EventRoleType } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, badRequest, notFound, serverError, unprocessable } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin, requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { createSubmissionSchema, listSubmissionsQuerySchema } from "@/lib/validators/submissions";
import { serializeSubmission } from "@/lib/services/submissions/serialize";
import { checkSubmissionEligibility, checkMemberRequirement } from "@/lib/services/submissions/eligibility";
import { writeAuditLog } from "@/lib/services/events/audit";
import { derivePortalState } from "@/lib/services/events/portal-state";
import { countAbstractBodyWords } from "@/lib/html";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);

    // Parse query params
    const url = new URL(request.url);
    const queryData = Object.fromEntries(url.searchParams.entries());
    const parsed = listSubmissionsQuerySchema.safeParse(queryData);
    const filters = parsed.success ? parsed.data : { page: 1, limit: 20 };

    // Check role — admins see all, submitters see own
    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    const isAdmin = adminAccess.ok;

    // Also check if track chair
    let isTrackChair = false;
    if (!isAdmin) {
      const chairAccess = await requireEventRole(auth.ctx, orgId, eventId, [
        EventRoleType.TRACK_CHAIR,
      ]);
      isTrackChair = chairAccess.ok;
    }

    const isPrivileged = isAdmin || isTrackChair;

    // Submitter role check if not privileged
    if (!isPrivileged) {
      const submitterAccess = await requireEventRole(auth.ctx, orgId, eventId, [
        EventRoleType.SUBMITTER,
      ]);
      // Allow if they are a submitter OR if they have no role (self-registered)
      // Submitters can only see their own submissions
    }

    const where: Record<string, unknown> = {
      eventId,
      orgId,
      deletedAt: null,
    };

    // Non-privileged users see only their own
    if (!isPrivileged) {
      where.submitterId = auth.ctx.user.id;
    }

    if (filters.status) where.status = filters.status;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.submissionTypeId) where.submissionTypeId = filters.submissionTypeId;
    if (filters.search) {
      where.title = { contains: filters.search, mode: "insensitive" };
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: { authors: { orderBy: { sortOrder: "asc" } }, affiliations: { orderBy: { number: "asc" } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.submission.count({ where }),
    ]);

    return ok({
      data: submissions.map((s) => serializeSubmission(s, { authors: s.authors, affiliations: s.affiliations })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /submissions", error);
    return serverError();
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);

    // Check event exists and get portal state
    const event = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
    if (!event) return notFound("Event not found");

    // Check if admin (admin can submit anytime)
    const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!adminAccess.ok) {
      // Non-admin: check submission window is open
      const portal = derivePortalState(event);
      if (!portal.canSubmit) {
        return unprocessable("Submissions are not currently open for this event.");
      }
    }

    const json = await request.json();
    const bodyParsed = parseBody(createSubmissionSchema, json);
    if (!bodyParsed.success) return bodyParsed.response;

    const data = bodyParsed.data;

    // Validate submissionType belongs to this event
    const submissionType = await prisma.submissionType.findFirst({
      where: { id: data.submissionTypeId, eventId, orgId },
    });
    if (!submissionType) return badRequest("Invalid submissionTypeId");

    // Validate category if provided
    if (data.categoryId) {
      const cat = await prisma.category.findFirst({ where: { id: data.categoryId, eventId, orgId } });
      if (!cat) return badRequest("Invalid categoryId");
    }

    // Eligibility check for the presenting author
    const presentingAuthor = data.authors?.find((a) => a.isPresenting);
    const eligibility = await checkSubmissionEligibility({
      eventId,
      orgId,
      submitterId: auth.ctx.user.id,
      presentingAuthorEmail: presentingAuthor?.email ?? null,
    });
    if (!eligibility.ok) {
      return unprocessable(eligibility.reason);
    }

    // Member check (warning only — stored in response)
    const memberCheck = await checkMemberRequirement({
      orgId,
      eventId,
      authorEmails: data.authors?.map((a) => a.email) ?? [],
      authorMembershipNos: data.authors?.map((a) => a.membershipNo).filter(Boolean) as string[] ?? [],
    });

    // Compute word count if abstractBody provided
    const computedWordCount = data.abstractBody
      ? countAbstractBodyWords(data.abstractBody)
      : (data.wordCount ?? 0);

    // Create submission
    const submission = (await prisma.submission.create({
      data: {
        orgId,
        eventId,
        submitterId: auth.ctx.user.id,
        submissionTypeId: data.submissionTypeId,
        categoryId: data.categoryId ?? null,
        title: data.title,
        status: "DRAFT",
        preferredPresentationType: data.preferredPresentationType ?? null,
        abstractBody: (data.abstractBody ?? {}) as Prisma.InputJsonValue,
        keywords: data.keywords ?? [],
        wordCount: computedWordCount,
        customFieldValues: (data.customFieldValues ?? {}) as Prisma.InputJsonValue,
        ercStatus: data.ercStatus ?? null,
        ercInstitution: data.ercInstitution ?? null,
        ercRefNo: data.ercRefNo ?? null,
        declarations: (data.declarations ?? {}) as Prisma.InputJsonValue,
        prevPublishedDetails: data.prevPublishedDetails ?? null,
        authors: data.authors
          ? {
              create: data.authors.map((a, i) => ({
                surname: a.surname,
                initials: a.initials,
                email: a.email,
                institution: a.institution ?? null,
                designation: a.designation ?? null,
                slmcNo: a.slmcNo ?? null,
                membershipNo: a.membershipNo ?? null,
                affiliationNos: a.affiliationNos ?? [],
                isPresenting: a.isPresenting ?? false,
                isCorresponding: a.isCorresponding ?? false,
                sortOrder: a.sortOrder ?? i,
              })),
            }
          : undefined,
        affiliations: data.affiliations
          ? { create: data.affiliations }
          : undefined,
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
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "submission.create",
      entity: "Submission",
      entityId: submission.id,
      after: { id: submission.id, title: submission.title, status: submission.status },
    });

    // Ensure submitter role
    await prisma.eventRole.upsert({
      where: { eventId_userId_role: { eventId, userId: auth.ctx.user.id, role: EventRoleType.SUBMITTER } },
      update: {},
      create: { eventId, userId: auth.ctx.user.id, role: EventRoleType.SUBMITTER },
    });

    return ok(
      {
        submission: serializeSubmission(submission, { authors: submission.authors, affiliations: submission.affiliations }),
        warnings: !memberCheck.memberFound && memberCheck.required
          ? ["No author email or membership number matched the member list. Member pricing may not apply."]
          : [],
      },
      201,
    );
  } catch (error) {
    console.error("POST /submissions", error);
    return serverError();
  }
}
