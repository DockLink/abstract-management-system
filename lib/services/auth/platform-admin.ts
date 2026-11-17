import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  getSupabaseAdmin,
  isPlatformAdminUser,
  serializeAppUser,
  upsertAppUser,
} from "@/lib/auth/supabase";
import { resolveOrInviteUser } from "@/lib/services/auth/invite";

export function serializePlatformAdmin(supabaseUser: SupabaseUser) {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? null,
    fullName:
      (supabaseUser.user_metadata?.full_name as string | undefined) ??
      (supabaseUser.user_metadata?.name as string | undefined) ??
      null,
    isPlatformAdmin: isPlatformAdminUser(supabaseUser),
  };
}

export async function grantPlatformAdmin(input: {
  email: string;
  fullName?: string;
}) {
  const { user, invited, supabaseUser } = await resolveOrInviteUser(input);
  const admin = getSupabaseAdmin();

  const nextMetadata = {
    ...(supabaseUser.app_metadata ?? {}),
    role: "platform_admin",
    platform_admin: true,
  };

  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: nextMetadata,
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to grant platform admin");
  }

  const appUser = await upsertAppUser(data.user, {
    fullName: input.fullName ?? null,
  });

  return {
    invited,
    user: serializeAppUser(appUser),
    isPlatformAdmin: true,
  };
}

export async function revokePlatformAdmin(userId: string) {
  const admin = getSupabaseAdmin();
  const { data: existing, error: getError } =
    await admin.auth.admin.getUserById(userId);

  if (getError || !existing.user) {
    return { ok: false as const, reason: "not_found" as const };
  }

  if (!isPlatformAdminUser(existing.user)) {
    return { ok: false as const, reason: "not_platform_admin" as const };
  }

  const nextMetadata = { ...(existing.user.app_metadata ?? {}) };
  delete nextMetadata.platform_admin;
  if (nextMetadata.role === "platform_admin") {
    delete nextMetadata.role;
  }

  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: nextMetadata,
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to revoke platform admin");
  }

  const appUser = await upsertAppUser(data.user);

  return {
    ok: true as const,
    user: serializeAppUser(appUser),
    isPlatformAdmin: false,
  };
}

export async function listPlatformAdmins() {
  const admin = getSupabaseAdmin();
  const admins: ReturnType<typeof serializePlatformAdmin>[] = [];

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;

    for (const user of data.users) {
      if (isPlatformAdminUser(user)) {
        admins.push(serializePlatformAdmin(user));
      }
    }

    if (data.users.length < 200) break;
  }

  return admins.sort((a, b) =>
    (a.email ?? "").localeCompare(b.email ?? "", undefined, {
      sensitivity: "base",
    }),
  );
}
