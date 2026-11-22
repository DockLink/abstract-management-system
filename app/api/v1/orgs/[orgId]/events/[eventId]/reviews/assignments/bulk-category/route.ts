import {
  EventRoleType,
  ReviewAssignmentStatus,
  SubmissionStatus,
} from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { bulkCategoryAssignSchema } from "@/lib/validators/reviews";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

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
    const parsed = parseBody(bulkCategoryAssignSchema, json);
    if (!parsed.success) return parsed.response;

    const { categoryId, reviewerIds, dueAt } = parsed.data;

    // Verify category
    const category = await prisma.category.findFirst({
      where: { id: categoryId, orgId, eventId },
    });
    if (!category) return notFound("Category not found");

    // Verify reviewers
    const reviewerRoles = await prisma.eventRole.findMany({
      where: {
        eventId,
        role: EventRoleType.REVIEWER,
        OR: [{ id: { in: reviewerIds } }, { userId: { in: reviewerIds } }],
      },
      include: { user: true },
    });

    if (reviewerRoles.length === 0) {
      return badRequest("No valid reviewers found for the provided IDs");
    }

    const validReviewerUserIds = reviewerRoles.map((r) => r.userId);
    const reviewerEmailMap = new Map(
      reviewerRoles.map((r) => [r.userId, r.user.email.toLowerCase()]),
    );

    // Fetch submissions in this category
    const submissions = await prisma.submission.findMany({
      where: {
        orgId,
        eventId,
        categoryId,
        status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW] },
        deletedAt: null,
      },
      include: {
        authors: true,
        reviewAssignments: {
          select: { reviewerId: true },
        },
      },
    });

    if (submissions.length === 0) {
      return ok({
        count: 0,
        submissionsCount: 0,
        message: "No submitted abstracts found in this category.",
      });
    }

    const assignmentsToCreate: Array<{
      orgId: string;
      eventId: string;
      submissionId: string;
      reviewerId: string;
      status: ReviewAssignmentStatus;
      dueAt: Date | null;
    }> = [];

    const submissionsToUpdate: string[] = [];

    for (const sub of submissions) {
      const existingReviewers = new Set(sub.reviewAssignments.map((a) => a.reviewerId));
      const authorEmails = new Set(sub.authors.map((a) => a.email.toLowerCase().trim()));

      let addedForSub = 0;
      for (const reviewerId of validReviewerUserIds) {
        if (existingReviewers.has(reviewerId)) continue;

        const email = reviewerEmailMap.get(reviewerId);
        if (email && authorEmails.has(email)) continue; // skip author conflict

        assignmentsToCreate.push({
          orgId,
          eventId,
          submissionId: sub.id,
          reviewerId,
          status: ReviewAssignmentStatus.PENDING,
          dueAt: dueAt ? new Date(dueAt) : null,
        });

        existingReviewers.add(reviewerId);
        addedForSub++;
      }

      if (sub.status === SubmissionStatus.SUBMITTED && addedForSub > 0) {
        submissionsToUpdate.push(sub.id);
      }
    }

    if (assignmentsToCreate.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.reviewAssignment.createMany({
          data: assignmentsToCreate,
          skipDuplicates: true,
        });

        if (submissionsToUpdate.length > 0) {
          await tx.submission.updateMany({
            where: { id: { in: submissionsToUpdate } },
            data: { status: SubmissionStatus.UNDER_REVIEW },
          });
        }
      });
    }

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "review_assignment.bulk_category",
      entity: "ReviewAssignment",
      after: {
        categoryId,
        assignmentsCreated: assignmentsToCreate.length,
        submissionsProcessed: submissions.length,
      },
    });

    return ok({
      count: assignmentsToCreate.length,
      submissionsCount: submissions.length,
      message: `Bulk category assignment completed: assigned ${assignmentsToCreate.length} reviews across ${submissions.length} submissions in category '${category.name}'.`,
    });
  } catch (error) {
    console.error("POST /reviews/assignments/bulk-category", error);
    return serverError();
  }
}

