import { parseBody } from "@/lib/api/validate";
import { unauthorized, ok, serverError } from "@/lib/api/response";
import { getSupabaseAnon } from "@/lib/auth/supabase";
import { sessionWithAppUser } from "@/lib/services/auth/session";
import { refreshSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = parseBody(refreshSchema, json);
    if (!parsed.success) return parsed.response;

    const supabase = getSupabaseAnon();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: parsed.data.refreshToken,
    });

    if (error || !data.session) {
      return unauthorized("Invalid or expired refresh token");
    }

    return ok(await sessionWithAppUser(data.session));
  } catch (error) {
    console.error("POST /auth/refresh", error);
    return serverError();
  }
}
