import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { badRequest, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { confirmSubmissionRegistration } from "@/lib/services/decisions/flagging";
import { offerWaitlistSlot } from "@/lib/services/decisions/slots";
import { writeAuditLog } from "@/lib/services/events/audit";
import { confirmationsActionSchema } from "@/lib/validators/decisions";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const admin = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!admin.ok) return admin.response;

    const json = await request.json();
    const parsed = parseBody(confirmationsActionSchema, json);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;
    const url = new URL(request.url);
    const appBaseUrl = `${url.protocol}//${url.host}`;

    if (body.action === "confirm") {
      let confirmedCount = 0;
      for (const subId of body.submissionIds) {
        const res = await confirmSubmissionRegistration(subId);
        if (res.success) confirmedCount++;
      }

      await writeAuditLog({
        orgId,
        eventId,
        actorId: auth.ctx.user.id,
        action: "submissions.manual_confirm",
        entity: "Submission",
        after: { confirmedCount, submissionIds: body.submissionIds },
      });

      return ok({ confirmedCount });
    } else if (body.action === "offer_waitlist") {
      // Find a waitlisted submission to promote
      const urlParams = new URL(request.url).searchParams;
      const waitlistedId = urlParams.get("waitlistedId");
      if (!waitlistedId) {
        return badRequest("Query parameter waitlistedId is required for offer_waitlist");
      }

      const res = await offerWaitlistSlot({
        orgId,
        eventId,
        declinedSubmissionId: body.declinedSubmissionId,
        waitlistedSubmissionId: waitlistedId,
        sendEmail: body.sendEmail,
        appBaseUrl,
      });

      await writeAuditLog({
        orgId,
        eventId,
        actorId: auth.ctx.user.id,
        action: "decisions.offer_waitlist",
        entity: "Submission",
        entityId: waitlistedId,
        after: {
          promotedRefNo: res.promotedRefNo,
          declinedSubmissionId: body.declinedSubmissionId,
        },
      });

      return ok(res);
    }

    return badRequest("Invalid action");
  } catch (error) {
    console.error("POST /decisions/confirmations error", error);
    return serverError();
  }
}

