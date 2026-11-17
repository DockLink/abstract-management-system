import { ok, serverError } from "@/lib/api/response";
import { requireAuth, serializeAppUser } from "@/lib/auth/supabase";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const [memberships, eventRoles] = await Promise.all([
      prisma.orgMembership.findMany({
        where: { userId: auth.ctx.user.id },
        include: {
          organisation: {
            select: { id: true, name: true, slug: true, logoPath: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.eventRole.findMany({
        where: { userId: auth.ctx.user.id },
        include: {
          event: {
            select: {
              id: true,
              orgId: true,
              name: true,
              slug: true,
              edition: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return ok({
      user: serializeAppUser(auth.ctx.user),
      isPlatformAdmin: auth.ctx.isPlatformAdmin,
      organisations: memberships.map((m) => ({
        membershipId: m.id,
        role: m.role,
        organisation: m.organisation,
        createdAt: m.createdAt.toISOString(),
      })),
      eventRoles: eventRoles.map((r) => ({
        id: r.id,
        role: r.role,
        categoryIds: r.categoryIds,
        event: r.event,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /auth/me", error);
    return serverError();
  }
}
