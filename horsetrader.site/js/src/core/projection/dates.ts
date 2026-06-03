/**
 * UTC date arithmetic for the projection — the daily-cadence stream expanders
 * (generator, sequence) and the dense balance fill. UTC throughout, so the
 * cadence is timezone-stable and never drifts across a DST boundary.
 */

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
