import type { Organisation, OrgMembership, OrgRole, User } from "@/app/generated/prisma/client";

export function serializeOrg(org: Organisation) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoPath: org.logoPath,
    address: org.address,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export function serializeMembership(
  membership: OrgMembership & { user?: Pick<User, "id" | "email" | "fullName"> },
) {
  return {
    id: membership.id,
    orgId: membership.orgId,
    userId: membership.userId,
    role: membership.role as OrgRole,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
    ...(membership.user
      ? {
          user: {
            id: membership.user.id,
            email: membership.user.email,
            fullName: membership.user.fullName,
          },
        }
      : {}),
  };
}
