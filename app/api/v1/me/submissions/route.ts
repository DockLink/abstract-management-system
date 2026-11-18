import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { prisma } from "@/lib/db/prisma";
import { mySubmissionsQuerySchema } from "@/lib/validators/submissions";
import { derivePortalState } from "@/lib/services/events/portal-state";
import { serializeSubmission } from "@/lib/services/submissions/serialize";

/**
 * GET /api/v1/me/submissions
 * SUB-16: Submitter dashboard — all my submissions, status, decision, reviewer comments,
 * and registration CTA when accepted.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const parsed = mySubmissionsQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const filters = parsed.success ? parsed.data : { page: 1, limit: 20 };

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      submitterId: auth.ctx.user.id,
      deletedAt: null,
    };

    if (filters.status) where.status = filters.status;
    if (filters.eventId) where.eventId = filters.eventId;

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          event: {
            include: {
              organisation: { select: { name: true, slug: true } },
            },
          },
          submissionType: { select: { id: true, name: true, wordLimit: true } },
          category: { select: { id: true, name: true } },
          authors: { orderBy: { sortOrder: "asc" } },
          affiliations: { orderBy: { number: "asc" } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.submission.count({ where }),
    ]);

    const items = submissions.map((s) => {
      const portalState = derivePortalState(s.event);
      const isAccepted = s.status === "ACCEPTED" || s.status === "CONFIRMED";
      const orgSlug = s.event.organisation.slug;
      const eventSlug = s.event.slug;

      return {
        ...serializeSubmission(s, { authors: s.authors, affiliations: s.affiliations }),
        event: {
          id: s.event.id,
          name: s.event.name,
          slug: s.event.slug,
          orgSlug,
          orgName: s.event.organisation.name,
          portalState,
          keyDates: {
            submissionOpenAt: s.event.submissionOpenAt?.toISOString() ?? null,
            submissionCloseAt: s.event.submissionCloseAt?.toISOString() ?? null,
            notificationAt: s.event.notificationAt?.toISOString() ?? null,
            registrationCloseAt: s.event.registrationCloseAt?.toISOString() ?? null,
          },
        },
        submissionTypeName: s.submissionType.name,
        categoryName: s.category?.name ?? null,
        // SUB-16 actions
        canEdit: portalState.canSubmit && ["DRAFT", "REVISIONS_REQUESTED"].includes(s.status),
        canWithdraw: ["DRAFT", "SUBMITTED"].includes(s.status),
        registerCta: isAccepted
          ? {
              label: "Register now",
              url: `/${orgSlug}/${eventSlug}/register`,
              confirmed: s.status === "CONFIRMED",
            }
          : null,
      };
    });

    return ok({
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/v1/me/submissions", error);
    return serverError();
  }
}

