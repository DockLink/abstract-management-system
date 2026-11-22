import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import {
  isPlatformAdminUser,
  serializeAppUser,
  upsertAppUser,
} from "@/lib/auth/supabase";

export function serializeSession(session: Session, supabaseUser: SupabaseUser) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    expiresAt: session.expires_at ?? null,
    tokenType: session.token_type,
    isPlatformAdmin: isPlatformAdminUser(supabaseUser),
  };
}

export async function sessionWithAppUser(session: Session) {
  const supabaseUser = session.user;
  const user = await upsertAppUser(supabaseUser);
  return {
    ...serializeSession(session, supabaseUser),
    user: serializeAppUser(user),
  };
}
