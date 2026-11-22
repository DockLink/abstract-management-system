import type { EventRole, EventRoleType, User } from "@/app/generated/prisma/client";

export function serializeEventRole(
  role: EventRole & {
    user?: Pick<User, "id" | "email" | "fullName">;
  },
) {
  return {
    id: role.id,
    eventId: role.eventId,
    userId: role.userId,
    role: role.role as EventRoleType,
    categoryIds: role.categoryIds,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
    ...(role.user
      ? {
          user: {
            id: role.user.id,
            email: role.user.email,
            fullName: role.user.fullName,
          },
        }
      : {}),
  };
}
