import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { categorySchema } from "@/lib/validators/events";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

function serializeCategory(c: {
  id: string;
  orgId: string;
  eventId: string;
  name: string;
  chairUserId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    orgId: c.orgId,
    eventId: c.eventId,
    name: c.name,
    chairUserId: c.chairUserId,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
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
    const isAdmin = access.ok;

    const categories = await prisma.category.findMany({
      where: { eventId, orgId },
      orderBy: { sortOrder: "asc" },
    });

    // Track chairs' identities are for organisers only.
    return ok(categories.map((c) => (isAdmin ? serializeCategory(c) : { ...serializeCategory(c), chairUserId: null })));
  } catch (error) {
    console.error("GET /categories", error);
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
    const parsed = parseBody(categorySchema, json);
    if (!parsed.success) return parsed.response;

    if (parsed.data.chairUserId) {
      const chair = await prisma.user.findUnique({
        where: { id: parsed.data.chairUserId },
      });
      if (!chair) return badRequest("chairUserId does not match a known user");
    }

    const category = await prisma.category.create({
      data: {
        orgId,
        eventId,
        name: parsed.data.name,
        chairUserId: parsed.data.chairUserId ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "category.create",
      entity: "Category",
      entityId: category.id,
      after: serializeCategory(category),
    });

    return ok(serializeCategory(category), 201);
  } catch (error) {
    console.error("POST /categories", error);
    return serverError();
  }
}
