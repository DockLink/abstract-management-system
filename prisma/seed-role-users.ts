/**
 * Dev-only: one test user per event role on the seeded event, so the
 * role-aware navigation can be checked by signing in as each.
 *
 *   yarn seed:roles            # create / update
 *   yarn seed:roles --remove   # delete these users again
 *
 * Users are <role>@example.com with SEED_TEST_PASSWORD (falls back to
 * SEED_ADMIN_PASSWORD). Idempotent. Never run against production.
 */
import "dotenv/config";
import {
  createClient,
  type SupabaseClient,
  type User as SupabaseUser,
} from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, EventRoleType } from "../app/generated/prisma/client";

const ORG_SLUG = process.env.SEED_ORG_SLUG?.trim() || "demo-college";
const EVENT_SLUG = "aas-2026";

type TestUser = {
  email: string;
  fullName: string;
  roles: EventRoleType[];
  /** Category names for chair/reviewer scoping (first N categories). */
  categories?: number;
};

const USERS: TestUser[] = [
  { email: "chair@example.com", fullName: "Dr. Chaminda Fernando", roles: [EventRoleType.TRACK_CHAIR], categories: 1 },
  { email: "reviewer@example.com", fullName: "Dr. Nirmala Wijesinghe", roles: [EventRoleType.REVIEWER], categories: 2 },
  { email: "finance@example.com", fullName: "Ms. Dilani Gunasekara", roles: [EventRoleType.FINANCE_OFFICER] },
  { email: "delegate@example.com", fullName: "Dr. Ruwan Jayasuriya", roles: [EventRoleType.DELEGATE] },
  {
    email: "multi@example.com",
    fullName: "Dr. Priyanka Herath",
    roles: [EventRoleType.TRACK_CHAIR, EventRoleType.REVIEWER, EventRoleType.SUBMITTER],
    categories: 2,
  },
];

function requireEnv(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function findAuthUser(
  admin: Pick<SupabaseClient, "auth">,
  email: string,
): Promise<SupabaseUser | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const remove = process.argv.includes("--remove");
  const password =
    process.env.SEED_TEST_PASSWORD?.trim() || requireEnv("SEED_ADMIN_PASSWORD");
  const admin = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }),
  });

  try {
    const org = await prisma.organisation.findUniqueOrThrow({ where: { slug: ORG_SLUG } });
    const event = await prisma.event.findFirstOrThrow({
      where: { orgId: org.id, slug: EVENT_SLUG, deletedAt: null },
    });
    const categories = await prisma.category.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: "asc" },
    });

    for (const u of USERS) {
      const existing = await findAuthUser(admin, u.email);

      if (remove) {
        if (existing) {
          await prisma.user.deleteMany({ where: { id: existing.id } });
          await admin.auth.admin.deleteUser(existing.id);
          console.log(`removed ${u.email}`);
        }
        continue;
      }

      const auth = existing
        ? (await admin.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
            user_metadata: { full_name: u.fullName },
          })).data.user
        : (await admin.auth.admin.createUser({
            email: u.email,
            password,
            email_confirm: true,
            user_metadata: { full_name: u.fullName },
          })).data.user;
      if (!auth) throw new Error(`Could not create ${u.email}`);

      await prisma.user.upsert({
        where: { id: auth.id },
        create: { id: auth.id, email: u.email, fullName: u.fullName },
        update: { email: u.email, fullName: u.fullName },
      });

      const categoryIds = categories.slice(0, u.categories ?? 0).map((c) => c.id);
      for (const role of u.roles) {
        const scoped = role === EventRoleType.TRACK_CHAIR || role === EventRoleType.REVIEWER;
        await prisma.eventRole.upsert({
          where: { eventId_userId_role: { eventId: event.id, userId: auth.id, role } },
          create: {
            eventId: event.id,
            userId: auth.id,
            role,
            categoryIds: scoped ? categoryIds : [],
            invitationStatus: role === EventRoleType.REVIEWER ? "ACCEPTED" : null,
          },
          update: { categoryIds: scoped ? categoryIds : [] },
        });
      }
      console.log(`${existing ? "updated" : "created"} ${u.email} → ${u.roles.join(", ")}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
