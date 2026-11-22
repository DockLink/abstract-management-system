import { parseBody } from "@/lib/api/validate";
import { unauthorized, ok, serverError } from "@/lib/api/response";
import { getSupabaseAnon } from "@/lib/auth/supabase";
import { sessionWithAppUser } from "@/lib/services/auth/session";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = parseBody(loginSchema, json);
    if (!parsed.success) return parsed.response;

    const supabase = getSupabaseAnon();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
    });

    if (error || !data.session) {
      return unauthorized("Invalid email or password");
    }

    return ok(await sessionWithAppUser(data.session));
  } catch (error) {
    console.error("POST /auth/login", error);
    return serverError();
  }
}
