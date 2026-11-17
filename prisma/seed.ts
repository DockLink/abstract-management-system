import "dotenv/config";
import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, OrgRole } from "../app/generated/prisma/client";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to run the seed`);
  }
  return value;
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function createSupabaseAdmin() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createSupabaseAdmin>,
  email: string,
): Promise<SupabaseUser | null> {
  const normalized = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
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

async function upsertSeedAdmin(input: {
  email: string;
  password: string;
  fullName: string;
}) {
  const admin = createSupabaseAdmin();
  const email = input.email.toLowerCase().trim();
  const appMetadata = {
    role: "platform_admin",
    platform_admin: true,
  };
  const userMetadata = {
    full_name: input.fullName,
  };

  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      app_metadata: {
        ...(existing.app_metadata ?? {}),
        ...appMetadata,
      },
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        ...userMetadata,
      },
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? "Failed to update seed admin");
    }
    return { user: data.user, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create seed admin");
  }
  return { user: data.user, created: true };
}

async function main() {
  const email = requireEnv("SEED_ADMIN_EMAIL");
  const password = requireEnv("SEED_ADMIN_PASSWORD");
  const fullName =
    process.env.SEED_ADMIN_FULL_NAME?.trim() || "Platform Admin";
  const orgName =
    process.env.SEED_ORG_NAME?.trim() || "Demo Medical College";
  const orgSlug = process.env.SEED_ORG_SLUG?.trim() || "demo-college";

  const prisma = createPrisma();

  try {
    const { user: supabaseUser, created } = await upsertSeedAdmin({
      email,
      password,
      fullName,
    });

    const appUser = await prisma.user.upsert({
      where: { id: supabaseUser.id },
      create: {
        id: supabaseUser.id,
        email: email.toLowerCase(),
        fullName,
      },
      update: {
        email: email.toLowerCase(),
        fullName,
      },
    });

    const organisation = await prisma.organisation.upsert({
      where: { slug: orgSlug },
      create: {
        name: orgName,
        slug: orgSlug,
      },
      update: {
        name: orgName,
      },
    });

    const membership = await prisma.orgMembership.upsert({
      where: {
        orgId_userId: {
          orgId: organisation.id,
          userId: appUser.id,
        },
      },
      create: {
        orgId: organisation.id,
        userId: appUser.id,
        role: OrgRole.ORG_ADMIN,
      },
      update: {
        role: OrgRole.ORG_ADMIN,
      },
    });

    console.log("Seed complete:");
    console.log(
      `  admin: ${appUser.email} (${created ? "created" : "updated"})`,
    );
    console.log(`  platform_admin: true`);
    console.log(`  organisation: ${organisation.name} (/${organisation.slug})`);
    console.log(`  membership: ${membership.role}`);
    console.log(`  login → /org/${organisation.slug}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
