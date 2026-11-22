import {
  EventRoleType,
  ReviewAssignmentStatus,
} from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { forbidden, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { getEventInOrg } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const event = await getEventInOrg(orgId, eventId);
    if (!event) return notFound("Event not found");

    const role = await prisma.eventRole.findFirst({
      where: {
        eventId,
        userId: auth.ctx.user.id,
        role: EventRoleType.REVIEWER,
      },
    });

    if (!role) {
      return forbidden("You are not a reviewer for this event");
    }

    const hasAgreedToConfidentiality = Boolean(role.confidentialityAgreedAt);

    // If reviewer has NOT agreed to confidentiality yet (REV-02), hide abstract details
    if (!hasAgreedToConfidentiality) {
      return ok({
        hasAgreedToConfidentiality: false,
        invitationStatus: role.invitationStatus,
        message: "You must accept the invitation and agree to confidentiality before accessing your assignments.",
        deadline: {
          reviewDeadlineAt: event.reviewDeadlineAt ? event.reviewDeadlineAt.toISOString() : null,
          daysRemaining: event.reviewDeadlineAt
            ? Math.ceil(
                (new Date(event.reviewDeadlineAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              )
            : null,
          isExpired: event.reviewDeadlineAt ? new Date(event.reviewDeadlineAt) < new Date() : false,
        },
        stats: {
          totalAssigned: 0,
          pending: 0,
          inProgress: 0,
          completed: 0,
          conflict: 0,
        },
        assignments: [],
      });
    }

    // Fetch assignments with reviews
    const assignments = await prisma.reviewAssignment.findMany({
      where: {
        orgId,
        eventId,
        reviewerId: auth.ctx.user.id,
      },
      include: {
        submission: {
          select: {
            id: true,
            refNo: true,
            title: true,
            preferredPresentationType: true,
            category: { select: { id: true, name: true } },
            submissionType: { select: { id: true, name: true } },
          },
        },
        review: {
          include: {
            scores: { include: { criterion: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    let pendingCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let conflictCount = 0;

    const assignmentList = assignments.map((a) => {
      if (a.status === ReviewAssignmentStatus.COMPLETED) completedCount++;
      else if (a.status === ReviewAssignmentStatus.IN_PROGRESS) inProgressCount++;
      else if (a.status === ReviewAssignmentStatus.CONFLICT) conflictCount++;
      else pendingCount++;

      // Calculate weighted score if completed
      let weightedScore: number | null = null;
      if (a.review && !a.review.isDraft && a.review.scores.length > 0) {
        let totalWeighted = 0;
        let totalWeight = 0;
        for (const s of a.review.scores) {
          const w = s.criterion.weight || 1.0;
          totalWeighted += s.score * w;
          totalWeight += w;
        }
        weightedScore = totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : null;
      }

      return {
        assignmentId: a.id,
        submissionId: a.submissionId,
        refNo: a.submission.refNo,
        title: a.submission.title,
        category: a.submission.category,
        submissionType: a.submission.submissionType,
        status: a.status,
        dueAt: a.dueAt ? a.dueAt.toISOString() : null,
        coiReason: a.coiReason,
        review: a.review
          ? {
              isDraft: a.review.isDraft,
              recommendation: a.review.recommendation,
              weightedScore,
              submittedAt: a.review.submittedAt ? a.review.submittedAt.toISOString() : null,
            }
          : null,
      };
    });

    const reviewDeadline = event.reviewDeadlineAt;
    const daysRemaining = reviewDeadline
      ? Math.ceil((new Date(reviewDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    const isExpired = reviewDeadline ? new Date(reviewDeadline) < new Date() : false;

    return ok({
      hasAgreedToConfidentiality: true,
      invitationStatus: role.invitationStatus,
      confidentialityAgreedAt: role.confidentialityAgreedAt?.toISOString(),
      deadline: {
        reviewDeadlineAt: reviewDeadline ? reviewDeadline.toISOString() : null,
        daysRemaining,
        isExpired,
      },
      stats: {
        totalAssigned: assignments.length,
        pending: pendingCount,
        inProgress: inProgressCount,
        completed: completedCount,
        conflict: conflictCount,
      },
      assignments: assignmentList,
    });
  } catch (error) {
    console.error("GET /reviews/my-dashboard", error);
    return serverError();
  }
}

