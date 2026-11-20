import { routeParams } from "@/lib/api/params";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { derivePortalState } from "@/lib/services/events/portal-state";
import { serializeEvent } from "@/lib/services/events/serialize";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const [
      categoriesCount,
      submissionTypesCount,
      presentationTypesCount,
      membersCount,
      deadlineExtensionsCount,
      eligibilityRule,
      byStatus,
      byCategory,
      byAssignmentStatus,
    ] = await Promise.all([
      prisma.category.count({ where: { eventId, orgId } }),
      prisma.submissionType.count({ where: { eventId, orgId } }),
      prisma.presentationType.count({ where: { eventId, orgId, isActive: true } }),
      prisma.member.count({ where: { orgId } }),
      prisma.deadlineExtension.count({ where: { eventId, orgId } }),
      prisma.eligibilityRule.findUnique({ where: { eventId } }),
      // EVT-11 metrics (Modules 2 and 3). Scoped by org + event; soft-deleted rows excluded.
      prisma.submission.groupBy({
        by: ["status"],
        where: { eventId, orgId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.submission.groupBy({
        by: ["categoryId"],
        where: { eventId, orgId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.reviewAssignment.groupBy({
        by: ["status"],
        where: { eventId, orgId },
        _count: { _all: true },
      }),
    ]);

    const submissionsByStatus: Record<string, number> = {};
    for (const row of byStatus) submissionsByStatus[row.status] = row._count._all;

    const categoryIds = byCategory.map((r) => r.categoryId).filter((id): id is string => !!id);
    const categoryNames = new Map(
      (
        await prisma.category.findMany({
          where: { id: { in: categoryIds }, eventId, orgId },
          select: { id: true, name: true },
        })
      ).map((c) => [c.id, c.name]),
    );
    const submissionsByCategory = byCategory.map((r) => ({
      categoryId: r.categoryId ?? "none",
      name: r.categoryId ? (categoryNames.get(r.categoryId) ?? "Unknown track") : "No track chosen",
      count: r._count._all,
    }));

    const assignmentCount = (status: string) =>
      byAssignmentStatus.find((r) => r.status === status)?._count._all ?? 0;
    const reviewsDone = assignmentCount("COMPLETED");
    const reviewsPending = assignmentCount("PENDING") + assignmentCount("IN_PROGRESS");

    const event = access.event;
    const portalState = derivePortalState(event);

    const configCompleteness = {
      hasKeyDates: Boolean(
        event.submissionOpenAt || event.submissionCloseAt,
      ),
      hasCategories: categoriesCount > 0,
      hasSubmissionTypes: submissionTypesCount > 0,
      hasPresentationTypes: presentationTypesCount > 0,
      hasEligibility: Boolean(eligibilityRule),
      hasGuidelines: Boolean(
        event.guidelinesRichText || event.guidelinesPdfPath,
      ),
      hasBranding: Boolean(event.logoPath || event.primaryColor),
      hasMembers: membersCount > 0,
    };

    return ok({
      event: serializeEvent(event),
      portalState,
      configCompleteness,
      submissionsByStatus,
      submissionsByCategory,
      // Conflicts are excluded: they're waiting for reassignment, not review.
      reviews: {
        done: reviewsDone,
        pending: reviewsPending,
        total: reviewsDone + reviewsPending,
      },
      // Module 5 (ticketing) isn't built yet.
      registrations: {
        count: 0,
        revenue: 0,
        currency: "LKR",
      },
      counts: {
        categories: categoriesCount,
        submissionTypes: submissionTypesCount,
        presentationTypes: presentationTypesCount,
        members: membersCount,
        deadlineExtensions: deadlineExtensionsCount,
      },
    });
  } catch (error) {
    console.error("GET /dashboard", error);
    return serverError();
  }
}
