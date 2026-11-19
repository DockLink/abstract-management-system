import {
  EventRoleType,
  ReviewAssignmentStatus,
} from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeReview } from "@/lib/services/reviews/serialize";
import { saveReviewSchema } from "@/lib/validators/reviews";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; assignmentId: string }>;
};

export async function PUT(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, assignmentId } = await routeParams(context);

    const assignment = await prisma.reviewAssignment.findFirst({
      where: { id: assignmentId, orgId, eventId },
    });
    if (!assignment) return notFound("Assignment not found");

    // Must be assigned reviewer or admin/chair
    const isOwner = assignment.reviewerId === auth.ctx.user.id;
    if (!isOwner) {
      const access = await requireEventRole(auth.ctx, orgId, eventId, [
        EventRoleType.EVENT_ADMIN,
        EventRoleType.TRACK_CHAIR,
      ]);
      if (!access.ok) {
        return forbidden("You can only review your own assignments");
      }
    }

    if (assignment.status === ReviewAssignmentStatus.CONFLICT) {
      return badRequest("Cannot review an assignment marked with Conflict of Interest");
    }

    const json = await request.json();
    const parsed = parseBody(saveReviewSchema, json);
    if (!parsed.success) return parsed.response;

    const { isDraft, scores = [], recommendation, commentAuthor, commentCommittee } =
      parsed.data;

    // Fetch rubric criteria to validate scales
    const criteria = await prisma.rubricCriterion.findMany({
      where: { orgId, eventId },
    });
    const criteriaMap = new Map(criteria.map((c) => [c.id, c]));

    // Validate that criterion IDs belong to this event
    for (const item of scores) {
      const crit = criteriaMap.get(item.criterionId);
      if (!crit) {
        return badRequest(`Criterion ${item.criterionId} not found in this event`);
      }
      if (item.score < crit.scaleMin || item.score > crit.scaleMax) {
        return badRequest(
          `Score for '${crit.name}' must be between ${crit.scaleMin} and ${crit.scaleMax}`,
        );
      }
    }

    // Strict validation if submitting (isDraft === false)
    if (!isDraft) {
      if (!recommendation) {
        return badRequest("Recommendation is required to submit review");
      }
      if (criteria.length > 0) {
        const scoredCritIds = new Set(scores.map((s) => s.criterionId));
        const missing = criteria.filter((c) => !scoredCritIds.has(c.id));
        if (missing.length > 0) {
          return badRequest(
            `All rubric criteria must be scored. Missing: ${missing.map((m) => m.name).join(", ")}`,
          );
        }
      }
    }

    const newAssignmentStatus = isDraft
      ? ReviewAssignmentStatus.IN_PROGRESS
      : ReviewAssignmentStatus.COMPLETED;

    // Upsert review and scores
    const review = await prisma.$transaction(async (tx) => {
      const existingReview = await tx.review.findUnique({
        where: { assignmentId },
      });

      let updatedReview;
      if (existingReview) {
        updatedReview = await tx.review.update({
          where: { id: existingReview.id },
          data: {
            recommendation: recommendation ?? existingReview.recommendation,
            commentAuthor,
            commentCommittee,
            isDraft,
            submittedAt: !isDraft ? new Date() : existingReview.submittedAt,
          },
        });
      } else {
        updatedReview = await tx.review.create({
          data: {
            orgId,
            eventId,
            assignmentId,
            recommendation,
            commentAuthor,
            commentCommittee,
            isDraft,
            submittedAt: !isDraft ? new Date() : null,
          },
        });
      }

      // Upsert scores
      for (const item of scores) {
        await tx.reviewScore.upsert({
          where: {
            reviewId_criterionId: {
              reviewId: updatedReview.id,
              criterionId: item.criterionId,
            },
          },
          create: {
            reviewId: updatedReview.id,
            criterionId: item.criterionId,
            score: item.score,
          },
          update: {
            score: item.score,
          },
        });
      }

      // Update assignment status
      await tx.reviewAssignment.update({
        where: { id: assignmentId },
        data: { status: newAssignmentStatus },
      });

      return tx.review.findUniqueOrThrow({
        where: { id: updatedReview.id },
        include: {
          scores: {
            include: { criterion: true },
          },
        },
      });
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: isDraft ? "review.save_draft" : "review.submit",
      entity: "Review",
      entityId: review.id,
      after: {
        assignmentId,
        recommendation: review.recommendation,
        isDraft: review.isDraft,
        submittedAt: review.submittedAt?.toISOString(),
        scoreCount: review.scores.length,
      },
    });

    return ok({
      success: true,
      status: newAssignmentStatus,
      isDraft,
      review: serializeReview(review),
      message: isDraft
        ? "Review draft auto-saved successfully"
        : "Review submitted successfully",
    });
  } catch (error) {
    console.error("PUT /reviews/assignments/:assignmentId/save", error);
    return serverError();
  }
}

