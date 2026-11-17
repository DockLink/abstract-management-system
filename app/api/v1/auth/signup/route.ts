import { parseBody } from "@/lib/api/validate";
import {
  badRequest,
  conflict,
  ok,
  serverError,
} from "@/lib/api/response";
import { getSupabaseAnon, upsertAppUser } from "@/lib/auth/supabase";
import { sessionWithAppUser } from "@/lib/services/auth/session";
import { signupSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = parseBody(signupSchema, json);
    if (!parsed.success) return parsed.response;

    const { email, password, fullName } = parsed.data;
    const supabase = getSupabaseAnon();

    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
      },
    });

    if (error) {
      if (
        error.message.toLowerCase().includes("already") ||
        error.message.toLowerCase().includes("registered")
      ) {
        return conflict("An account with this email already exists");
      }
      return badRequest(error.message);
    }

    if (!data.user) {
      return serverError("Signup succeeded but no user returned");
    }

    await upsertAppUser(data.user, { fullName: fullName ?? null });

    if (!data.session) {
      // Email confirmation may be required in Supabase project settings
      return ok(
        {
          user: {
            id: data.user.id,
            email: data.user.email,
            fullName: fullName ?? null,
          },
          session: null,
          message:
            "Account created. Confirm your email if required, then log in.",
        },
        201,
      );
    }

    return ok(await sessionWithAppUser(data.session), 201);
  } catch (error) {
    console.error("POST /auth/signup", error);
    return serverError();
  }
}
