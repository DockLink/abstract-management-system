import { ok, serverError } from "@/lib/api/response";
import { getSupabaseUserClient, requireAuth } from "@/lib/auth/supabase";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const supabase = getSupabaseUserClient(auth.ctx.accessToken);
    await supabase.auth.signOut();

    return ok({ loggedOut: true });
  } catch (error) {
    console.error("POST /auth/logout", error);
    return serverError();
  }
}
