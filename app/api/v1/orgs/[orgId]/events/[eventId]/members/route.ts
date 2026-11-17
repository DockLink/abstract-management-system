import { routeParams } from "@/lib/api/params";
import {
  badRequest,
  ok,
  serverError,
  unprocessable,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { parseMembersCsv } from "@/lib/services/events/members-csv";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

function serializeMember(m: {
  id: string;
  orgId: string;
  name: string;
  membershipNo: string | null;
  slmcNo: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: m.id,
    orgId: m.orgId,
    name: m.name,
    membershipNo: m.membershipNo,
    slmcNo: m.slmcNo,
    email: m.email,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();

    const members = await prisma.member.findMany({
      where: {
        orgId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { membershipNo: { contains: q, mode: "insensitive" } },
                { slmcNo: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 500,
    });

    return ok(members.map(serializeMember));
  } catch (error) {
    console.error("GET /members", error);
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

    const contentType = request.headers.get("content-type") ?? "";
    let rows;
    let parseErrors: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return badRequest("CSV file field 'file' is required");
      }
      const text = await file.text();
      const parsed = parseMembersCsv(text);
      rows = parsed.rows;
      parseErrors = parsed.errors;
    } else if (contentType.includes("application/json")) {
      const json = await request.json();
      if (!Array.isArray(json?.members)) {
        return badRequest("Body must be { members: [...] } or multipart CSV");
      }
      rows = json.members.map(
        (m: {
          name?: string;
          membershipNo?: string | null;
          membership_number?: string | null;
          slmcNo?: string | null;
          slmc_number?: string | null;
          email?: string | null;
        }) => ({
          name: String(m.name ?? "").trim(),
          membershipNo:
            (m.membershipNo ?? m.membership_number ?? null)?.toString().trim() ||
            null,
          slmcNo:
            (m.slmcNo ?? m.slmc_number ?? null)?.toString().trim() || null,
          email: (m.email ?? null)?.toString().trim().toLowerCase() || null,
        }),
      );
      rows = rows.filter((r: { name: string }) => r.name.length > 0);
    } else {
      return badRequest("Send multipart/form-data with file=CSV or application/json");
    }

    if (parseErrors.length && rows.length === 0) {
      return unprocessable("CSV parse failed", parseErrors);
    }

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      let existing = null;
      if (row.membershipNo) {
        existing = await prisma.member.findFirst({
          where: { orgId, membershipNo: row.membershipNo },
        });
      }
      if (!existing && row.email) {
        existing = await prisma.member.findFirst({
          where: { orgId, email: row.email },
        });
      }

      if (existing) {
        await prisma.member.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            membershipNo: row.membershipNo ?? existing.membershipNo,
            slmcNo: row.slmcNo ?? existing.slmcNo,
            email: row.email ?? existing.email,
          },
        });
        updated += 1;
      } else {
        await prisma.member.create({
          data: {
            orgId,
            name: row.name,
            membershipNo: row.membershipNo,
            slmcNo: row.slmcNo,
            email: row.email,
          },
        });
        created += 1;
      }
    }

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "members.import",
      entity: "Member",
      after: { created, updated, parseErrors },
    });

    return ok({
      created,
      updated,
      parseErrors,
      totalProcessed: rows.length,
    });
  } catch (error) {
    console.error("POST /members", error);
    return serverError();
  }
}
