import type { Event, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  decisionSettingsSchema,
  type DecisionSettings,
} from "@/lib/validators/decisions";

/** Reads events.settings.decisions, filling defaults for anything unset. */
export function readDecisionSettings(event: Pick<Event, "settings">): DecisionSettings {
  const settings = (event.settings ?? {}) as Record<string, unknown>;
  const parsed = decisionSettingsSchema.safeParse(settings.decisions ?? {});
  return parsed.success ? parsed.data : decisionSettingsSchema.parse({});
}

export async function writeDecisionSettings(
  event: Pick<Event, "id" | "settings">,
  patch: Partial<DecisionSettings>,
): Promise<DecisionSettings> {
  const next = decisionSettingsSchema.parse({ ...readDecisionSettings(event), ...patch });
  const settings = { ...((event.settings ?? {}) as Record<string, unknown>), decisions: next };
  await prisma.event.update({
    where: { id: event.id },
    data: { settings: settings as Prisma.InputJsonValue },
  });
  return next;
}

/** DEC-09 date: the explicit setting, else the event's registration close. */
export function registrationDueAt(
  event: Pick<Event, "settings" | "registrationCloseAt">,
): Date | null {
  const s = readDecisionSettings(event);
  if (s.registrationDueAt) return new Date(s.registrationDueAt);
  return event.registrationCloseAt ?? null;
}
