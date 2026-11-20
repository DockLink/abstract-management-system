import { EventRoleType, type Event } from "@/app/generated/prisma/client";
import { forbidden } from "@/lib/api/response";
import { requireEventAdmin, requireEventRole } from "@/lib/auth/rbac";
import type { AuthContext } from "@/lib/auth/supabase";
import { prisma } from "@/lib/db/prisma";

/**
 * Who may use the decision board.
 *
 * - Event admin (and org/platform admins via rbac): everything, every category.
 * - Track chair: only their categories (EventRole.categoryIds plus categories
 *   where they are the named chair). They record a *recommendation* unless the
 *   admin granted `canMakeFinalDecisions`, in which case they decide.
 *   Release, cut-offs, templates and exports stay admin-only.
 */
export type DecisionAccess = {
  event: Event;
  isAdmin: boolean;
  /** null = all categories */
  categoryIds: string[] | null;
  canDecide: boolean;
};

export async function requireDecisionAccess(
  ctx: AuthContext,
  orgId: string,
  eventId: string,
): Promise<{ ok: true; access: DecisionAccess } | { ok: false; response: Response }> {
  const admin = await requireEventAdmin(ctx, orgId, eventId);
  if (admin.ok) {
    return {
      ok: true,
      access: { event: admin.event, isAdmin: true, categoryIds: null, canDecide: true },
    };
  }

  const chair = await requireEventRole(ctx, orgId, eventId, [EventRoleType.TRACK_CHAIR]);
  if (!chair.ok) return { ok: false, response: chair.response };

  const role = chair.eventRole;
  if (!role || role.role !== EventRoleType.TRACK_CHAIR) {
    return { ok: false, response: forbidden("Track chair or event admin required") };
  }

  const chaired = await prisma.category.findMany({
    where: { eventId, orgId, chairUserId: ctx.user.id },
    select: { id: true },
  });
  const categoryIds = Array.from(new Set([...role.categoryIds, ...chaired.map((c) => c.id)]));

  return {
    ok: true,
    access: {
      event: chair.event,
      isAdmin: false,
      categoryIds,
      canDecide: role.canMakeFinalDecisions,
    },
  };
}

export function categoryAllowed(access: DecisionAccess, categoryId: string | null): boolean {
  if (access.categoryIds === null) return true;
  return !!categoryId && access.categoryIds.includes(categoryId);
}
