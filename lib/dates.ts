import { differenceInCalendarDays, isValid, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const EVENT_TZ = "Asia/Colombo";

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

/** Display format: "03 Nov 2026, 2:30 PM" in Asia/Colombo. */
export function formatEventDate(
  value: Date | string | null | undefined,
  options?: { includeTime?: boolean },
): string {
  const date = toDate(value);
  if (!date) return "—";
  const includeTime = options?.includeTime ?? true;
  const pattern = includeTime ? "dd MMM yyyy, h:mm a" : "dd MMM yyyy";
  return formatInTimeZone(date, EVENT_TZ, pattern);
}

/** House style date: "19 November 2026" (Asia/Colombo). */
export function formatLongDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return formatInTimeZone(date, EVENT_TZ, "d MMMM yyyy");
}

/** House style date + time: "19 November 2026, 11:59 pm" (Asia/Colombo). */
export function formatLongDateTime(
  value: Date | string | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return formatInTimeZone(date, EVENT_TZ, "d MMMM yyyy, h:mm aaa");
}

/** Clock time for autosave stamps: "12:04" (24h, Asia/Colombo). */
export function formatClockTime(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  return formatInTimeZone(date, EVENT_TZ, "HH:mm");
}

export function toAsiaColombo(value: Date | string): Date {
  const date = toDate(value) ?? new Date();
  return toZonedTime(date, EVENT_TZ);
}

export function isDeadlinePassed(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  const date = toDate(value);
  if (!date) return false;
  return now > date;
}

/** Relative label vs Asia/Colombo calendar days: "in 3 days" / "2 days ago" / "today". */
export function formatRelativeToNow(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) return "";
  const zonedTarget = toZonedTime(date, EVENT_TZ);
  const zonedNow = toZonedTime(now, EVENT_TZ);
  const days = differenceInCalendarDays(zonedTarget, zonedNow);
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  if (days === -1) return "1 day ago";
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function formatLkr(amount: number): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function toIsoOrNull(value: Date | string | null | undefined): string | null {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

export function formatCompactDay(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return formatInTimeZone(date, EVENT_TZ, "dd MMM");
}

/** For inputs that need a local datetime-local value in Colombo. */
export function toDatetimeLocalValue(
  value: Date | string | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return "";
  return formatInTimeZone(date, EVENT_TZ, "yyyy-MM-dd'T'HH:mm");
}

export function fromDatetimeLocalValue(value: string): Date | null {
  if (!value) return null;
  // Interpret the wall-clock Colombo time as an absolute instant via offset.
  const asColombo = new Date(`${value}:00+05:30`);
  return isValid(asColombo) ? asColombo : null;
}

export function formatDayMonthYear(value: Date | string): string {
  return formatInTimeZone(toDate(value) ?? new Date(), EVENT_TZ, "dd MMM yyyy");
}
