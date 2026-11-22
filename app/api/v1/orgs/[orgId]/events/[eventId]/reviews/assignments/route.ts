import {
  EventRoleType,
  ReviewAssignmentStatus,
  SubmissionStatus,
} from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, conflict, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeReviewAssignment } from "@/lib/services/reviews/serialize";
import {
  createAssignmentSchema,
  batchAssignSchema,
  listAssignmentsQuerySchema,
} from "@/lib/validators/reviews";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const url = new URL(request.url);
    const queryData = Object.fromEntries(url.searchParams.entries());
    const parsedQuery = listAssignmentsQuerySchema.safeParse(queryData);
    const filters = parsedQuery.success ? parsedQuery.data : { page: 1, limit: 20 };

    const where: Record<string, unknown> = {
      orgId,
      eventId,
    };

    if (filters.submissionId) where.submissionId = filters.submissionId;
    if (filters.reviewerId) where.reviewerId = filters.reviewerId;
    if (filters.status) where.status = filters.status;
    if (filters.categoryId) {
      where.submission = { categoryId: filters.categoryId };
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const [assignments, total] = await Promise.all([
      prisma.reviewAssignment.findMany({
        where,
        include: {
          reviewer: {
            select: { id: true, email: true, fullName: true, institution: true },
          },
          submission: {
            include: {
              category: { select: { id: true, name: true } },
              submissionType: { select: { id: true, name: true } },
            },
          },
          review: {
            include: {
              scores: {
                include: { criterion: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.reviewAssignment.count({ where }),
    ]);

    return ok({
      data: assignments.map(serializeReviewAssignment),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /reviews/assignments", error);
    return serverError();
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const json = await request.json();

    // Support both single assignment and batch assignments
    const isBatch = Array.isArray(json?.assignments);
    const toProcess: Array<{ submissionId: string; reviewerId: string; dueAt?: string | null }> =
      [];

    if (isBatch) {
      const parsedBatch = parseBody(batchAssignSchema, json);
      if (!parsedBatch.success) return parsedBatch.response;
      toProcess.push(...parsedBatch.data.assignments);
    } else {
      const parsedSingle = parseBody(createAssignmentSchema, json);
      if (!parsedSingle.success) return parsedSingle.response;
      toProcess.push(parsedSingle.data);
    }

    const createdAssignments = [];

    for (const item of toProcess) {
      // 1. Verify submission exists in this event
      const submission = await prisma.submission.findFirst({
        where: { id: item.submissionId, orgId, eventId, deletedAt: null },
        include: { authors: true },
      });
      if (!submission) {
        return notFound(`Submission ${item.submissionId} not found`);
      }

      // 2. Verify reviewer has REVIEWER role on this event
      const reviewerRole = await prisma.eventRole.findFirst({
        where: {
          eventId,
          role: EventRoleType.REVIEWER,
          OR: [{ id: item.reviewerId }, { userId: item.reviewerId }],
        },
        include: { user: true },
      });
      if (!reviewerRole) {
        return badRequest(`Reviewer ${item.reviewerId} is not a valid reviewer for this event`);
      }

      const reviewerUserId = reviewerRole.userId;

      // 3. Co-author conflict check
      const isCoAuthor = submission.authors.some(
        (a) => a.email.toLowerCase() === reviewerRole.user.email.toLowerCase(),
      );
      if (isCoAuthor) {
        return badRequest(
          `Reviewer ${reviewerRole.user.email} is an author on submission ${submission.refNo || submission.id}`,
        );
      }

      // 4. Duplicate assignment check
      const existing = await prisma.reviewAssignment.findUnique({
        where: {
          submissionId_reviewerId: {
            submissionId: submission.id,
            reviewerId: reviewerUserId,
          },
        },
      });
      if (existing) {
        if (!isBatch) {
          return conflict("Reviewer is already assigned to this submission");
        }
        continue; // In batch mode, skip duplicates
      }

      // 5. Create assignment & update submission status if needed
      const assignment = await prisma.$transaction(async (tx) => {
        const created = await tx.reviewAssignment.create({
          data: {
            orgId,
            eventId,
            submissionId: submission.id,
            reviewerId: reviewerUserId,
            status: ReviewAssignmentStatus.PENDING,
            dueAt: item.dueAt ? new Date(item.dueAt) : null,
          },
          include: {
            reviewer: {
              select: { id: true, email: true, fullName: true, institution: true },
            },
            submission: {
              include: {
                category: { select: { id: true, name: true } },
                submissionType: { select: { id: true, name: true } },
              },
            },
          },
        });

        if (submission.status === SubmissionStatus.SUBMITTED) {
          await tx.submission.update({
            where: { id: submission.id },
            data: { status: SubmissionStatus.UNDER_REVIEW },
          });
        }

        return created;
      });

      await writeAuditLog({
        orgId,
        eventId,
        actorId: auth.ctx.user.id,
        action: "review_assignment.create",
        entity: "ReviewAssignment",
        entityId: assignment.id,
        after: {
          submissionId: assignment.submissionId,
          reviewerId: assignment.reviewerId,
        },
      });

      createdAssignments.push(assignment);
    }

    if (!isBatch && createdAssignments.length > 0) {
      return ok(serializeReviewAssignment(createdAssignments[0]), 201);
    }

    return ok(
      {
        count: createdAssignments.length,
        assignments: createdAssignments.map(serializeReviewAssignment),
      },
      201,
    );
  } catch (error) {
    console.error("POST /reviews/assignments", error);
    return serverError();
  }
}

