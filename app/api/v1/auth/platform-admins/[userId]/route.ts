import { routeParams } from "@/lib/api/params";
import {
  badRequest,
  notFound,
  ok,
  serverError,
  unprocessable,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/supabase";
import { requirePlatformAdmin } from "@/lib/auth/rbac";
import { revokePlatformAdmin } from "@/lib/services/auth/platform-admin";

type Ctx = { params: Promise<{ userId: string }> };

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const platform = requirePlatformAdmin(auth.ctx);
    if (!platform.ok) return platform.response;

    const { userId } = await routeParams(context);
    if (!userId) return badRequest("userId is required");

    if (userId === auth.ctx.user.id) {
      return unprocessable("You cannot revoke your own platform admin access");
    }

    const result = await revokePlatformAdmin(userId);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return notFound("User not found");
      }
      return unprocessable("User is not a platform admin");
    }

    return ok({
      user: result.user,
      isPlatformAdmin: result.isPlatformAdmin,
      revoked: true,
    });
  } catch (error) {
    console.error("DELETE /auth/platform-admins/:userId", error);
    return serverError(
      error instanceof Error ? error.message : "Internal server error",
    );
  }
}
