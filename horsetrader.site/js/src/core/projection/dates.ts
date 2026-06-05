/**
 * Date primitives for the projection.
 *
 * The fold still works in plain ISO dates (`YYYY-MM-DD`): the ledger, axis and
 * dense balance cache are day-bucketed by design. Baked event periods, however,
 * arrive as instants. Convert those at the edge into the selected view timezone,
 * then keep the rest of the projection on date-only strings.
 */

export const UTC_TIME_ZONE = "UTC";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    });
    dateFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** True when `timeZone` is a usable IANA/UTC timezone identifier for this runtime. */
export function isSupportedTimeZone(timeZone: string | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    formatterFor(timeZone).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

/**
 * The browser/system timezone, with UTC as the deterministic server-time
 * fallback. This reads browser settings only; it does not use geolocation.
 */
export function defaultTimeZone(): string {
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isSupportedTimeZone(timeZone) ? timeZone : UTC_TIME_ZONE;
}

/** A Date/instant rendered as an ISO calendar date in `timeZone`. */
export function dateInTimeZone(instant: Date, timeZone: string = UTC_TIME_ZONE): string {
  const parts = formatterFor(isSupportedTimeZone(timeZone) ? timeZone : UTC_TIME_ZONE).formatToParts(instant);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) throw new Error(`Could not format date in timezone ${timeZone}`);
  return `${year}-${month}-${day}`;
}

/**
 * A baked date/date-time string → an ISO date in the view timezone. Date-only
 * legacy values are already calendar dates, so they pass through unchanged.
 */
export function dateStringInTimeZone(value: string, timeZone: string = UTC_TIME_ZONE): string {
  if (ISO_DATE.test(value)) return value;
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) throw new Error(`Invalid date/time string: ${value}`);
  return dateInTimeZone(instant, timeZone);
}

/** Current date in the selected view timezone. */
export function todayInTimeZone(timeZone: string = UTC_TIME_ZONE, now: Date = new Date()): string {
  return dateInTimeZone(now, timeZone);
}

/** ISO date `days` after `date` (UTC). */
export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both ISO dates, UTC); negative if `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z");
  return Math.round(ms / 86_400_000);
}
