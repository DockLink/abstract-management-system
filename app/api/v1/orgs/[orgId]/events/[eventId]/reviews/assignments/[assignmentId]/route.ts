import {
  EventRoleType,
  ReviewAssignmentStatus,
} from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { forbidden, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { getEventInOrg, requireEventRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import {
  serializeBlindSubmissionForReviewer,
  serializeReview,
  serializeRubricCriterion,
} from "@/lib/services/reviews/serialize";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; assignmentId: string }>;
};

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, assignmentId } = await routeParams(context);
    const event = await getEventInOrg(orgId, eventId);
    if (!event) return notFound("Event not found");

    const assignment = await prisma.reviewAssignment.findFirst({
      where: { id: assignmentId, orgId, eventId },
      include: {
        reviewer: {
          select: { id: true, email: true, fullName: true, institution: true },
        },
        submission: {
          include: {
            authors: { orderBy: { sortOrder: "asc" } },
            affiliations: { orderBy: { number: "asc" } },
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
    });

    if (!assignment) return notFound("Review assignment not found");

    // Access check: Reviewer who owns the assignment OR Admin / Track Chair
    const isOwner = assignment.reviewerId === auth.ctx.user.id;
    let isPrivileged = false;

    if (!isOwner) {
      const access = await requireEventRole(auth.ctx, orgId, eventId, [
        EventRoleType.EVENT_ADMIN,
        EventRoleType.TRACK_CHAIR,
      ]);
      isPrivileged = access.ok;
      if (!isPrivileged) {
        return forbidden("You do not have permission to view this review assignment");
      }
    }

    // REV-02: Reviewer must accept confidentiality before seeing any abstract
    if (isOwner && !isPrivileged) {
      const reviewerRole = await prisma.eventRole.findFirst({
        where: {
          eventId,
          userId: auth.ctx.user.id,
          role: EventRoleType.REVIEWER,
        },
      });

      if (!reviewerRole?.confidentialityAgreedAt) {
        return forbidden(
          "You must accept the confidentiality agreement before viewing any abstract",
        );
      }
    }

    // Fetch rubric criteria
    const criteria = await prisma.rubricCriterion.findMany({
      where: { orgId, eventId },
      orderBy: { sortOrder: "asc" },
    });

    // Find previous and next assignment IDs for navigation (REV-08)
    const allUserAssignments = await prisma.reviewAssignment.findMany({
      where: {
        orgId,
        eventId,
        reviewerId: assignment.reviewerId,
        status: { not: ReviewAssignmentStatus.CONFLICT },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const currentIndex = allUserAssignments.findIndex((a) => a.id === assignment.id);
    const prevAssignmentId =
      currentIndex > 0 ? allUserAssignments[currentIndex - 1].id : null;
    const nextAssignmentId =
      currentIndex >= 0 && currentIndex < allUserAssignments.length - 1
        ? allUserAssignments[currentIndex + 1].id
        : null;

    // Check if event allows reviewers to see other scores (REV-12)
    const eventSettings = (event.settings as Record<string, unknown>) || {};
    const allowOtherScores = Boolean(eventSettings.allowReviewersSeeOtherScores);
    let otherReviews: unknown[] = [];

    if (
      allowOtherScores &&
      assignment.status === ReviewAssignmentStatus.COMPLETED &&
      !isPrivileged
    ) {
      const otherAssignments = await prisma.reviewAssignment.findMany({
        where: {
          submissionId: assignment.submissionId,
          id: { not: assignment.id },
          status: ReviewAssignmentStatus.COMPLETED,
        },
        include: {
          review: {
            include: { scores: { include: { criterion: true } } },
          },
        },
      });

      otherReviews = otherAssignments
        .filter((a) => a.review && !a.review.isDraft)
        .map((a) => ({
          recommendation: a.review?.recommendation,
          scores: a.review?.scores.map((s) => ({
            criterionId: s.criterionId,
            score: s.score,
          })),
        }));
    }

    // Format submission respecting blind mode (REV-03)
    const blindSubmission = serializeBlindSubmissionForReviewer(
      assignment.submission,
      event,
    );

    return ok({
      assignment: {
        id: assignment.id,
        status: assignment.status,
        dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
        coiReason: assignment.coiReason,
        createdAt: assignment.createdAt.toISOString(),
        reviewer: isPrivileged ? assignment.reviewer : undefined,
      },
      submission: blindSubmission,
      rubricCriteria: criteria.map(serializeRubricCriterion),
      review: assignment.review ? serializeReview(assignment.review) : null,
      navigation: {
        currentIndex: currentIndex >= 0 ? currentIndex + 1 : 1,
        totalAssignments: allUserAssignments.length,
        prevAssignmentId,
        nextAssignmentId,
      },
      otherReviews: allowOtherScores ? otherReviews : undefined,
    });
  } catch (error) {
    console.error("GET /reviews/assignments/:assignmentId", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, assignmentId } = await routeParams(context);
    const access = await requireEventRole(auth.ctx, orgId, eventId, [
      EventRoleType.EVENT_ADMIN,
      EventRoleType.TRACK_CHAIR,
    ]);
    if (!access.ok) return access.response;

    const assignment = await prisma.reviewAssignment.findFirst({
      where: { id: assignmentId, orgId, eventId },
    });
    if (!assignment) return notFound("Assignment not found");

    await prisma.reviewAssignment.delete({ where: { id: assignmentId } });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "review_assignment.delete",
      entity: "ReviewAssignment",
      entityId: assignment.id,
      before: {
        submissionId: assignment.submissionId,
        reviewerId: assignment.reviewerId,
      },
    });

    return ok({ success: true, message: "Assignment deleted successfully" });
  } catch (error) {
    console.error("DELETE /reviews/assignments/:assignmentId", error);
    return serverError();
  }
}

