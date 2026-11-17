import { parseBody } from "@/lib/api/validate";
import { badRequest, ok, serverError } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requirePlatformAdmin } from "@/lib/auth/rbac";
import {
  grantPlatformAdmin,
  listPlatformAdmins,
} from "@/lib/services/auth/platform-admin";
import { grantPlatformAdminSchema } from "@/lib/validators/auth";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const platform = requirePlatformAdmin(auth.ctx);
    if (!platform.ok) return platform.response;

    const admins = await listPlatformAdmins();
    return ok(admins);
  } catch (error) {
    console.error("GET /auth/platform-admins", error);
    return serverError(
      error instanceof Error ? error.message : "Internal server error",
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const platform = requirePlatformAdmin(auth.ctx);
    if (!platform.ok) return platform.response;

    const json = await request.json();
    const parsed = parseBody(grantPlatformAdminSchema, json);
    if (!parsed.success) return parsed.response;

    const result = await grantPlatformAdmin({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
    });

    return ok(result, result.invited ? 201 : 200);
  } catch (error) {
    console.error("POST /auth/platform-admins", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    if (
      message.toLowerCase().includes("already") ||
      message.toLowerCase().includes("invite")
    ) {
      return badRequest(message);
    }
    return serverError(message);
  }
}
