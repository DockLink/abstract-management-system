import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { updateCategorySchema } from "@/lib/validators/events";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; categoryId: string }>;
};

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

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, categoryId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const existing = await prisma.category.findFirst({
      where: { id: categoryId, eventId, orgId },
    });
    if (!existing) return notFound("Category not found");

    const json = await request.json();
    const parsed = parseBody(updateCategorySchema, json);
    if (!parsed.success) return parsed.response;

    if (parsed.data.chairUserId) {
      const chair = await prisma.user.findUnique({
        where: { id: parsed.data.chairUserId },
      });
      if (!chair) return badRequest("chairUserId does not match a known user");
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.chairUserId !== undefined
          ? { chairUserId: parsed.data.chairUserId }
          : {}),
        ...(parsed.data.sortOrder !== undefined
          ? { sortOrder: parsed.data.sortOrder }
          : {}),
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "category.update",
      entity: "Category",
      entityId: categoryId,
      before: serializeCategory(existing),
      after: serializeCategory(category),
    });

    return ok(serializeCategory(category));
  } catch (error) {
    console.error("PATCH /categories/:id", error);
    return serverError();
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, categoryId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const existing = await prisma.category.findFirst({
      where: { id: categoryId, eventId, orgId },
    });
    if (!existing) return notFound("Category not found");

    await prisma.category.delete({ where: { id: categoryId } });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "category.delete",
      entity: "Category",
      entityId: categoryId,
      before: serializeCategory(existing),
    });

    return ok({ id: categoryId, deleted: true });
  } catch (error) {
    console.error("DELETE /categories/:id", error);
    return serverError();
  }
}
