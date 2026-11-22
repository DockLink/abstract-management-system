import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { parseBody } from "@/lib/api/validate";
import { conflict, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requirePlatformAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { serializeOrg } from "@/lib/services/orgs/serialize";
import { createOrgSchema } from "@/lib/validators/orgs";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    if (auth.ctx.isPlatformAdmin) {
      const orgs = await prisma.organisation.findMany({
        orderBy: { name: "asc" },
      });
      return ok(orgs.map(serializeOrg));
    }

    const memberships = await prisma.orgMembership.findMany({
      where: { userId: auth.ctx.user.id },
      include: { organisation: true },
      orderBy: { createdAt: "asc" },
    });

    return ok(memberships.map((m) => serializeOrg(m.organisation)));
  } catch (error) {
    // Let Next.js prerender-bailout signals propagate (cacheComponents).
    unstable_rethrow(error);
    console.error("GET /orgs", error);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const platform = requirePlatformAdmin(auth.ctx);
    if (!platform.ok) return platform.response;

    const json = await request.json();
    const parsed = parseBody(createOrgSchema, json);
    if (!parsed.success) return parsed.response;

    try {
      const org = await prisma.organisation.create({
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          address: parsed.data.address ?? null,
        },
      });

      await writeAuditLog({
        orgId: org.id,
        actorId: auth.ctx.user.id,
        action: "org.create",
        entity: "Organisation",
        entityId: org.id,
        after: serializeOrg(org),
      });

      return ok(serializeOrg(org), 201);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return conflict("An organisation with this slug already exists");
      }
      throw error;
    }
  } catch (error) {
    console.error("POST /orgs", error);
    return serverError();
  }
}
