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
import { serializeEvent } from "@/lib/services/events/serialize";
import { uploadEventAsset, type AssetKind } from "@/lib/services/events/storage";
import { assetKindSchema } from "@/lib/validators/events";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const access = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!access.ok) return access.response;

    const form = await request.formData();
    const kindRaw = form.get("kind");
    const file = form.get("file");

    const kindParsed = assetKindSchema.safeParse(kindRaw);
    if (!kindParsed.success) {
      return badRequest("kind must be one of: logo, banner, guidelines");
    }
    if (!(file instanceof File)) {
      return badRequest("file is required");
    }

    const kind = kindParsed.data as AssetKind;
    const uploaded = await uploadEventAsset({ orgId, eventId, kind, file });
    if (!uploaded.ok) {
      if (uploaded.reason === "TOO_LARGE") {
        return unprocessable("File exceeds 5 MB limit");
      }
      if (uploaded.reason === "INVALID_MIME") {
        return unprocessable(
          kind === "guidelines"
            ? "Guidelines must be a PDF"
            : "Logo/banner must be png, jpeg, or webp",
        );
      }
      return serverError("Upload failed", uploaded.error);
    }

    const field =
      kind === "logo"
        ? "logoPath"
        : kind === "banner"
          ? "bannerPath"
          : "guidelinesPdfPath";

    const event = await prisma.event.update({
      where: { id: eventId },
      data: { [field]: uploaded.path },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "event.asset.upload",
      entity: "Event",
      entityId: eventId,
      after: { kind, path: uploaded.path },
    });

    return ok({
      kind,
      path: uploaded.path,
      event: serializeEvent(event),
    });
  } catch (error) {
    console.error("POST /assets", error);
    return serverError();
  }
}
