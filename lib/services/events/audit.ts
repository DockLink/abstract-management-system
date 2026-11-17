import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function writeAuditLog(input: {
  orgId: string;
  eventId?: string | null;
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      eventId: input.eventId ?? null,
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before:
        input.before === undefined || input.before === null
          ? undefined
          : (input.before as Prisma.InputJsonValue),
      after:
        input.after === undefined || input.after === null
          ? undefined
          : (input.after as Prisma.InputJsonValue),
    },
  });
}
