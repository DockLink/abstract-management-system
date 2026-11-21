import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db/prisma";
import { unauthorized } from "@/lib/api/response";
import type { User } from "@/app/generated/prisma/client";

function publishableKey() {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    // Legacy key: remove once it is disabled in Supabase.
    process.env.SUPABASE_ANON_KEY
  );
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  // Never fall back to a public key: admin calls would fail with confusing errors.
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    // Legacy key: remove once it is disabled in Supabase.
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getSupabaseAnon() {
  const url = process.env.SUPABASE_URL;
  const key = publishableKey();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export type AuthContext = {
  supabaseUser: SupabaseUser;
  user: User;
  isPlatformAdmin: boolean;
  accessToken: string;
};

export function isPlatformAdminUser(supabaseUser: SupabaseUser): boolean {
  return (
    supabaseUser.app_metadata?.role === "platform_admin" ||
    supabaseUser.app_metadata?.platform_admin === true
  );
}

export async function upsertAppUser(
  supabaseUser: SupabaseUser,
  overrides?: { fullName?: string | null },
): Promise<User> {
  const email = supabaseUser.email;
  if (!email) {
    throw new Error("Authenticated user has no email");
  }

  const fullName =
    overrides?.fullName ??
    (supabaseUser.user_metadata?.full_name as string | undefined) ??
    (supabaseUser.user_metadata?.name as string | undefined) ??
    null;

  return prisma.user.upsert({
    where: { id: supabaseUser.id },
    create: {
      id: supabaseUser.id,
      email,
      fullName,
    },
    update: {
      email,
      ...(fullName ? { fullName } : {}),
    },
  });
}

export function getSupabaseUserClient(accessToken: string) {
  const url = process.env.SUPABASE_URL;
  const key = publishableKey();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function serializeAppUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    slmcNo: user.slmcNo,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function requireAuth(request: Request) {
  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false as const, response: unauthorized() };
  }

  const supabase = getSupabaseAnon();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false as const,
      response: unauthorized("Invalid or expired token"),
    };
  }

  const user = await upsertAppUser(data.user);
  const isPlatformAdmin = isPlatformAdminUser(data.user);

  return {
    ok: true as const,
    ctx: {
      supabaseUser: data.user,
      user,
      isPlatformAdmin,
      accessToken: token,
    } satisfies AuthContext,
  };
}
