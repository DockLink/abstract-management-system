import { EventRoleType } from "@/app/generated/prisma/client";
import { routeParams } from "@/lib/api/params";
import { forbidden, notFound, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventRole } from "@/lib/auth/rbac";
import { generateReviewerCertificate } from "@/lib/services/reviews/certificate";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string; reviewerId: string }>;
};

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, reviewerId } = await routeParams(context);

    // Can be viewed by the reviewer themselves, or Event Admin / Track Chair
    const isOwner = reviewerId === auth.ctx.user.id;
    if (!isOwner) {
      const access = await requireEventRole(auth.ctx, orgId, eventId, [
        EventRoleType.EVENT_ADMIN,
        EventRoleType.TRACK_CHAIR,
      ]);
      if (!access.ok) {
        return forbidden("You do not have permission to view this certificate");
      }
    }

    const certificate = await generateReviewerCertificate(orgId, eventId, reviewerId);
    if (!certificate) {
      return notFound("Reviewer or event not found");
    }

    const url = new URL(request.url);
    if (url.searchParams.get("format") === "html") {
      return new Response(certificate.html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    return ok(certificate);
  } catch (error) {
    console.error("GET /reviews/certificate/:reviewerId", error);
    return serverError();
  }
}

