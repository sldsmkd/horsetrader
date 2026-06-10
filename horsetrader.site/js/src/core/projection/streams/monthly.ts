/**
 * The monthly cadence shared by the calendar-month income channels (club-rank,
 * shop-tickets): one flat emission on the **1st of each month** at server reset —
 * the realised moment for the month that just closed, and (for the shop) when the
 * stores refresh. Like the other channels only month-starts strictly after `after`
 * emit; earlier ones are already baked into the snapshot reading. The payout is
 * flat, so there is no phase to advance — the cadence is purely the dates.
 */

import type { ResourceVector, StreamEmission } from "../ledger.ts";
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE, dateStringInTimeZone } from "../dates.ts";

/** A `YYYY-MM-01` calendar date for the given year and zero-based month (overflow rolls the year). */
function firstOf(year: number, month: number): CalendarDate {
  return dateStringInTimeZone(new Date(Date.UTC(year, month, 1)).toISOString(), UTC_TIME_ZONE);
}

/** The first day of the calendar month on or after `date` (UTC). */
export function monthStartOnOrAfter(date: CalendarDate): CalendarDate {
  const d = new Date(date + "T00:00:00Z");
  if (d.getUTCDate() === 1) return date;
  return firstOf(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** The first day of the month after the one `date` falls in (UTC). */
function nextMonthStart(date: CalendarDate): CalendarDate {
  const d = new Date(date + "T00:00:00Z");
  return firstOf(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/**
 * Emit `deltas` (attributed to `source`) on every month-start across
 * `[epoch, horizon]`, skipping any on or before `after`. Empty `deltas` is allowed
 * (a "none" bracket) — it simply produces no contribution against the balance.
 */
export function monthlyStream(
  epoch: CalendarDate,
  horizon: CalendarDate,
  after: CalendarDate,
  source: string,
  deltas: ResourceVector,
): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  if (epoch > horizon) return emissions;

  let month = monthStartOnOrAfter(epoch);
  while (month <= horizon) {
    if (month > after) emissions.push({ date: month, source, deltas: { ...deltas } });
    month = nextMonthStart(month);
  }
  return emissions;
}
