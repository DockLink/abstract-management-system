import { routeParams } from "@/lib/api/params";
import { badRequest, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireDecisionAccess } from "@/lib/services/decisions/access";
import {
  generateAbstractBookDocx,
  generateAbstractBookHtml,
} from "@/lib/services/decisions/abstract-book";
import { prisma } from "@/lib/db/prisma";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireDecisionAccess(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "docx";
    const includeAccepted = url.searchParams.get("includeAccepted") === "true";

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { slug: true },
    });
    const filenamePrefix = event?.slug || "event";

    if (format === "html") {
      const html = await generateAbstractBookHtml(orgId, eventId, includeAccepted);
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    } else if (format === "docx") {
      const docxBuffer = await generateAbstractBookDocx(orgId, eventId, includeAccepted);
      return new Response(new Uint8Array(docxBuffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${filenamePrefix}-abstract-book.docx"`,
        },
      });
    }

    return badRequest("Supported formats are docx and html");
  } catch (error) {
    console.error("GET /decisions/export/abstract-book error", error);
    return serverError();
  }
}

