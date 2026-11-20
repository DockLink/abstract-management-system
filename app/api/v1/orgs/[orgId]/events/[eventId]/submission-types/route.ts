import { Prisma } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { DEFAULT_IMRAD_SECTIONS } from "@/lib/services/events/defaults";
import { submissionTypeSchema } from "@/lib/validators/events";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

function serializeType(t: {
  id: string;
  orgId: string;
  eventId: string;
  name: string;
  wordLimit: number;
  sections: unknown;
  requiresErc: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    orgId: t.orgId,
    eventId: t.eventId,
    name: t.name,
    wordLimit: t.wordLimit,
    sections: t.sections,
    requiresErc: t.requiresErc,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    // Admins get everything. Any other signed-in user may read the options an
    // author picks from when submitting (same rule as POST /submissions);
    // a missing event still 404s.
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok && access.response.status !== 403) return access.response;
    // Nothing organiser-only in this payload.

    const types = await prisma.submissionType.findMany({
      where: { eventId, orgId },
      orderBy: { sortOrder: "asc" },
    });

    return ok(types.map(serializeType));
  } catch (error) {
    console.error("GET /submission-types", error);
    return serverError();
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const json = await request.json();
    const parsed = parseBody(submissionTypeSchema, json);
    if (!parsed.success) return parsed.response;

    const sections =
      parsed.data.sections ??
      ([...DEFAULT_IMRAD_SECTIONS] as unknown as Prisma.InputJsonValue);

    const type = await prisma.submissionType.create({
      data: {
        orgId,
        eventId,
        name: parsed.data.name,
        wordLimit: parsed.data.wordLimit ?? 300,
        sections,
        requiresErc: parsed.data.requiresErc ?? false,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "submission_type.create",
      entity: "SubmissionType",
      entityId: type.id,
      after: serializeType(type),
    });

    return ok(serializeType(type), 201);
  } catch (error) {
    console.error("POST /submission-types", error);
    return serverError();
  }
}
