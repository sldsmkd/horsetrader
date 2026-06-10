/**
 * Date primitives for the projection.
 *
 * The fold works in calendar dates (`YYYY-MM-DD`): the ledger, axis and dense
 * balance cache are day-bucketed by design — that day-bucketing is load-bearing
 * (the dense `date → balance` cache is what makes scrub O(1)) and timezone-aware
 * (an instant lands on different calendar days for different viewers), so we keep
 * it rather than carrying instants through the core. Baked event periods arrive as
 * **instants** (`…T22:00:00+00:00`); convert those to a calendar date *once*, at
 * the ingress edge, then stay on calendar dates everywhere downstream.
 *
 * `CalendarDate` brands that bucketed space so a raw instant can no longer be
 * passed where a calendar date is expected — that exact mismatch once fell a spend
 * emission silently through the dense series (see project_core_utc_and_ingress).
 * The brand is compile-time only (erased at build, zero runtime cost): it does not
 * *stop* a bad value, it makes the IDE flag the one place that skipped the
 * conversion. Mint a `CalendarDate` only via the converters here, or `cal()` for a
 * value already known to be a calendar date (a stored snapshot date, a literal).
 */

export const UTC_TIME_ZONE = "UTC";

/**
 * A calendar date `YYYY-MM-DD` in the projection's view timezone — the bucket key
 * for the whole core. A branded `string`: assignable *to* `string` (compares,
 * formats, Map keys all work) but a plain `string` (a raw instant included) is not
 * assignable back without going through a converter or `cal()`.
 */
export type CalendarDate = string & { readonly __calendarDate: unique symbol };

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

/**
 * Brand a string already known to be a `YYYY-MM-DD` calendar date — the only
 * hand-mint, for values that enter the core already bucketed (a stored snapshot
 * date, a test literal) rather than as a baked instant. Validates the shape so the
 * brand stays an honest promise; throws on anything that is not a bare ISO date.
 */
export function cal(value: string): CalendarDate {
  if (!ISO_DATE.test(value)) throw new Error(`Not a calendar date: ${value}`);
  return value as CalendarDate;
}

/** A Date/instant rendered as an ISO calendar date in `timeZone`. */
export function dateInTimeZone(instant: Date, timeZone: string = UTC_TIME_ZONE): CalendarDate {
  const parts = formatterFor(isSupportedTimeZone(timeZone) ? timeZone : UTC_TIME_ZONE).formatToParts(instant);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) throw new Error(`Could not format date in timezone ${timeZone}`);
  return `${year}-${month}-${day}` as CalendarDate;
}

/**
 * A baked date/date-time string → a calendar date in the view timezone. This is
 * *the* ingress converter: it turns a raw instant into the bucketed `CalendarDate`
 * the core runs on. Date-only legacy values are already calendar dates, so they
 * pass through (re-branded) unchanged.
 */
export function dateStringInTimeZone(value: string, timeZone: string = UTC_TIME_ZONE): CalendarDate {
  if (ISO_DATE.test(value)) return value as CalendarDate;
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) throw new Error(`Invalid date/time string: ${value}`);
  return dateInTimeZone(instant, timeZone);
}

/** Current date in the selected view timezone. */
export function todayInTimeZone(timeZone: string = UTC_TIME_ZONE, now: Date = new Date()): CalendarDate {
  return dateInTimeZone(now, timeZone);
}

/** Calendar date `days` after `date` (UTC). */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10) as CalendarDate;
}

/** Whole days from `from` to `to` (both calendar dates, UTC); negative if `to` precedes `from`. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  const ms = Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z");
  return Math.round(ms / 86_400_000);
}
