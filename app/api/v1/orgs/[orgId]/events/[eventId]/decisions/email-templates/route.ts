import { routeParams } from "@/lib/api/params";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_DECISION_TEMPLATES } from "@/lib/services/decisions/emails";

type Ctx = { params: Promise<{ orgId: string; eventId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);
    const admin = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!admin.ok) return admin.response;

    const customTemplates = await prisma.emailTemplate.findMany({
      where: { orgId, eventId },
    });

    const customMap = new Map(customTemplates.map((t) => [t.key, t]));

    const templates = DEFAULT_DECISION_TEMPLATES.map((def) => {
      const custom = customMap.get(def.key);
      return {
        key: def.key,
        label: def.label,
        subject: custom ? custom.subject : def.subject,
        body: custom ? custom.body : def.body,
        isCustomized: !!custom,
        updatedAt: custom ? custom.updatedAt.toISOString() : null,
      };
    });

    return ok(templates);
  } catch (error) {
    console.error("GET /decisions/email-templates error", error);
    return serverError();
  }
}

