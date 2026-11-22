import { routeParams } from "@/lib/api/params";
import { serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireDecisionAccess } from "@/lib/services/decisions/access";
import { generateSubmissionsExcel } from "@/lib/services/decisions/export-excel";
import { prisma } from "@/lib/db/prisma";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireDecisionAccess(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { slug: true },
    });
    const filenamePrefix = event?.slug || "event";

    const buffer = await generateSubmissionsExcel(orgId, eventId, access.access.categoryIds);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenamePrefix}-submissions-and-scores.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /decisions/export/excel error", error);
    return serverError();
  }
}

