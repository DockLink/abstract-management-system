import { routeParams } from "@/lib/api/params";
import { parseBody } from "@/lib/api/validate";
import { ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/events/audit";
import { upsertEmailTemplateSchema } from "@/lib/validators/decisions";

type Ctx = { params: Promise<{ orgId: string; eventId: string; key: string }> };

export async function PUT(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId, key } = await routeParams(context);
    const admin = await requireEventAdmin(auth.ctx, orgId, eventId);
    if (!admin.ok) return admin.response;

    const json = await request.json();
    const parsed = parseBody(upsertEmailTemplateSchema, json);
    if (!parsed.success) return parsed.response;

    const template = await prisma.emailTemplate.upsert({
      where: {
        eventId_key: { eventId, key },
      },
      create: {
        orgId,
        eventId,
        key,
        subject: parsed.data.subject,
        body: parsed.data.body,
      },
      update: {
        subject: parsed.data.subject,
        body: parsed.data.body,
      },
    });

    await writeAuditLog({
      orgId,
      eventId,
      actorId: auth.ctx.user.id,
      action: "email_template.upsert",
      entity: "EmailTemplate",
      entityId: template.id,
      after: { key, subject: template.subject },
    });

    return ok(template);
  } catch (error) {
    console.error("PUT /decisions/email-templates/[key] error", error);
    return serverError();
  }
}

