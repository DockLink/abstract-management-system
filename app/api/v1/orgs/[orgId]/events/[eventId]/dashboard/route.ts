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
    ] = await Promise.all([
      prisma.category.count({ where: { eventId, orgId } }),
      prisma.submissionType.count({ where: { eventId, orgId } }),
      prisma.presentationType.count({ where: { eventId, orgId, isActive: true } }),
      prisma.member.count({ where: { orgId } }),
      prisma.deadlineExtension.count({ where: { eventId, orgId } }),
      prisma.eligibilityRule.findUnique({ where: { eventId } }),
    ]);

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
      // Module 2+ metrics — stable contract, zeroed until those modules land
      submissionsByStatus: {},
      submissionsByCategory: [],
      reviews: {
        done: 0,
        pending: 0,
        total: 0,
      },
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
