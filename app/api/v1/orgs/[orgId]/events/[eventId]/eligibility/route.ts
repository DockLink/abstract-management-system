import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { eligibilitySchema } from "@/lib/validators/events";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

function serialize(rule: {
  id: string;
  orgId: string;
  eventId: string;
  maxAbstractsPerAuthor: number;
  requireMemberAuthor: boolean;
  presentingAuthorMustRegister: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: rule.id,
    orgId: rule.orgId,
    eventId: rule.eventId,
    maxAbstractsPerAuthor: rule.maxAbstractsPerAuthor,
    requireMemberAuthor: rule.requireMemberAuthor,
    presentingAuthorMustRegister: rule.presentingAuthorMustRegister,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const rule = await prisma.eligibilityRule.findUnique({
      where: { eventId },
    });

    if (!rule) {
      const created = await prisma.eligibilityRule.create({
        data: {
          orgId,
          eventId,
          maxAbstractsPerAuthor: 2,
          requireMemberAuthor: false,
          presentingAuthorMustRegister: true,
        },
      });
      return ok(serialize(created));
    }

    return ok(serialize(rule));
  } catch (error) {
    console.error("GET /eligibility", error);
    return serverError();
  }
}

export async function PUT(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(eligibilitySchema, json);
    if (!parsed.success) return parsed.response;

    const existing = await prisma.eligibilityRule.findUnique({
      where: { eventId },
    });

    const rule = await prisma.eligibilityRule.upsert({
      where: { eventId },
      create: {
        orgId,
        eventId,
        maxAbstractsPerAuthor: parsed.data.maxAbstractsPerAuthor,
        requireMemberAuthor: parsed.data.requireMemberAuthor,
        presentingAuthorMustRegister: parsed.data.presentingAuthorMustRegister,
      },
      update: {
        maxAbstractsPerAuthor: parsed.data.maxAbstractsPerAuthor,
        requireMemberAuthor: parsed.data.requireMemberAuthor,
        presentingAuthorMustRegister: parsed.data.presentingAuthorMustRegister,
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "eligibility.update",
      entity: "EligibilityRule",
      entityId: rule.id,
      before: existing ? serialize(existing) : null,
      after: serialize(rule),
    });

    return ok(serialize(rule));
  } catch (error) {
    console.error("PUT /eligibility", error);
    return serverError();
  }
}
