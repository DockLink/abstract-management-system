import { routeParams } from "@/lib/api/params";
import { ok, forbidden, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requireEventAdmin } from "@/lib/auth/rbac";
import { duplicateCheckQuerySchema } from "@/lib/validators/submissions";
import { findDuplicateTitles } from "@/lib/services/submissions/duplicate";
import type { z } from "zod";

type Ctx = {
  params: Promise<{ orgId: string; eventId: string }>;
};

/**
 * GET /submissions/duplicate-check?title=...&excludeId=...&threshold=...
 * SUB-15: Check for duplicate or near-identical abstract titles.
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { orgId, eventId } = await routeParams(context);

    const url = new URL(request.url);
    const parsed = duplicateCheckQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const query: Partial<z.infer<typeof duplicateCheckQuerySchema>> = parsed.success ? parsed.data : {};

    // If query.title is not supplied, pairwise clustering is admin-only
    if (!query.title) {
      const adminAccess = await requireEventAdmin(auth.ctx, orgId, eventId);
      if (!adminAccess.ok) {
        return forbidden("Admin permission required to scan all event duplicates.");
      }
    }

    const result = await findDuplicateTitles({
      eventId,
      title: query.title,
      excludeId: query.excludeId,
      threshold: query.threshold,
    });

    return ok(result);
  } catch (error) {
    console.error("GET /submissions/duplicate-check", error);
    return serverError();
  }
}
