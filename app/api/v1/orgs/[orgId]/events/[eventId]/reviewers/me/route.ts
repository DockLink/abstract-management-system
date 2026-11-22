import { EventRoleType, ReviewerInviteStatus } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { forbidden, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { getEventInOrg } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { reviewerAcceptSchema } from "@/lib/validators/reviews";

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
      include: {
        user: { select: { id: true, email: true, fullName: true, institution: true } },
      },
    });

    if (!role) {
      return forbidden("You are not a reviewer for this event");
    }

    const categories = await prisma.category.findMany({
      where: { orgId, eventId, id: { in: role.categoryIds } },
      select: { id: true, name: true },
    });

    return ok({
      id: role.id,
      userId: role.userId,
      email: role.user.email,
      fullName: role.user.fullName,
      institution: role.user.institution,
      categoryIds: role.categoryIds,
      categories,
      maxLoad: role.maxLoad ?? 20,
      invitationStatus: role.invitationStatus ?? "PENDING",
      confidentialityAgreedAt: role.confidentialityAgreedAt
        ? role.confidentialityAgreedAt.toISOString()
        : null,
      hasAgreedToConfidentiality: Boolean(role.confidentialityAgreedAt),
      reviewDeadlineAt: event.reviewDeadlineAt ? event.reviewDeadlineAt.toISOString() : null,
    });
  } catch (error) {
    console.error("GET /events/:id/reviewers/me", error);
    return serverError();
  }
}

export async function POST(request: Request, context: Ctx) {
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

    const json = await request.json();
    const parsed = parseBody(reviewerAcceptSchema, json);
    if (!parsed.success) return parsed.response;

    const updated = await prisma.eventRole.update({
      where: { id: role.id },
      data: {
        invitationStatus: ReviewerInviteStatus.ACCEPTED,
        confidentialityAgreedAt: new Date(),
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "reviewer.accept_confidentiality",
      entity: "EventRole",
      entityId: role.id,
      after: {
        invitationStatus: updated.invitationStatus,
        confidentialityAgreedAt: updated.confidentialityAgreedAt?.toISOString(),
      },
    });

    return ok({
      success: true,
      invitationStatus: updated.invitationStatus,
      confidentialityAgreedAt: updated.confidentialityAgreedAt?.toISOString(),
      message: "Confidentiality agreement accepted successfully. You now have access to your review assignments.",
    });
  } catch (error) {
    console.error("POST /events/:id/reviewers/me", error);
    return serverError();
  }
}

