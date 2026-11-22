import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseAdmin, upsertAppUser } from "@/lib/auth/supabase";
import { prisma } from "@/lib/db/prisma";
import type { User } from "@/app/generated/prisma/client";

async function findAuthUserByEmail(email: string): Promise<SupabaseUser | null> {
  const admin = getSupabaseAdmin();
  const normalized = email.toLowerCase();

  // Paginate lightly; enough for Module 1 bootstrap volumes
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Invite a user by email via Supabase. If they already exist, reuse that account.
 */
export async function resolveOrInviteUser(input: {
  email: string;
  fullName?: string;
}): Promise<{ user: User; invited: boolean; supabaseUser: SupabaseUser }> {
  const email = input.email.toLowerCase().trim();
  const admin = getSupabaseAdmin();
  const redirectTo = process.env.AUTH_INVITE_REDIRECT_URL;

  const existing = await findAuthUserByEmail(email);
  if (existing) {
    const user = await upsertAppUser(existing, {
      fullName: input.fullName ?? null,
    });
    return { user, invited: false, supabaseUser: existing };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: input.fullName ? { full_name: input.fullName } : undefined,
    redirectTo: redirectTo || undefined,
  });

  if (error || !data.user) {
    // Race: user may have been created between list and invite
    const raced = await findAuthUserByEmail(email);
    if (raced) {
      const user = await upsertAppUser(raced, {
        fullName: input.fullName ?? null,
      });
      return { user, invited: false, supabaseUser: raced };
    }
    throw new Error(error?.message ?? "Failed to invite user");
  }

  const user = await upsertAppUser(data.user, {
    fullName: input.fullName ?? null,
  });

  // Ensure local email is normalized
  if (user.email !== email) {
    await prisma.user.update({
      where: { id: user.id },
      data: { email },
    });
  }

  return {
    user: { ...user, email },
    invited: true,
    supabaseUser: data.user,
  };
}
