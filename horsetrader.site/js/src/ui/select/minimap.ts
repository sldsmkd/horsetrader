/**
 * The minimap selector (view-model): the carat-domain logic behind the
 * consolidated balance instrument (ui.md "The minimap, consolidated"). Pure and
 * DOM-free — it knows carats, frets and favourites, but nothing about pixels or
 * the x-axis. The view owns the measured width and turns these into geometry.
 *
 * The minimap is **another view over the one ledger + fold** (architecture.md):
 * the line is the same running balance the cursor reads, sampled across the whole
 * extent; the dots are the same favourited banners the bookmarks list shows.
 */

import type { BalanceSeries } from "../../core/projection/ledger.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import type { Bundle } from "../bundle/access.ts";
import type { BannerKind } from "./aboveLane.ts";
import type { Favourites } from "../../core/persistence/document.ts";

/** One pity in carats — the fret spacing and the unit the line is *read* in. */
export const PITY = 30_000;
/** The display band, in pities either side of the origin — the community's
 *  guaranteed-MLB envelope. The line clamps here (clamp, don't run off). */
export const BAND_PITIES = 3;
/** The band edge in carats (±90k). */
export const BAND = PITY * BAND_PITIES;

/** One sampled balance point — a date and its carat balance. The view maps the
 *  date to x (minimap axis) and the carats to y (`caratToY`). */
export interface BalancePoint {
  date: CalendarDate;
  carats: number;
}

/** One favourited banner appearance — its date and kind (→ dot colour). */
export interface DotMark {
  date: CalendarDate;
  kind: BannerKind;
}

/**
 * The balance polyline: the carat balance sampled across `extent`. Balance only
 * moves on change-points, so a polyline through the change-points inside the
 * extent (plus the two extent ends, which anchor the flat runs before the first
 * and after the last) is *exact* and O(change-points) — no per-day sampling.
 */
export function balancePoints(series: BalanceSeries, extent: readonly [CalendarDate, CalendarDate]): BalancePoint[] {
  const [lo, hi] = extent;
  const dates = new Set<CalendarDate>([lo, hi]);
  for (const date of series.dates) {
    if (date >= lo && date <= hi) dates.add(date);
  }
  return [...dates]
    .sort()
    .map((date) => ({ date, carats: series.balanceAt(date).free_carats ?? 0 }));
}

/**
 * Map a carat balance to a y in `[0, height]`, clamped to the ±BAND envelope:
 * +BAND at the top (y=0), −BAND at the bottom (y=height), origin centred. Clamps
 * beyond the band so a runaway balance stays readable rather than flying off.
 */
export function caratToY(carats: number, height: number): number {
  const clamped = Math.max(-BAND, Math.min(BAND, carats));
  return ((BAND - clamped) / (2 * BAND)) * height;
}

/** The fret carat levels — every pity boundary across the band, top to bottom. */
export function fretLevels(): number[] {
  const levels: number[] = [];
  for (let pity = BAND_PITIES; pity >= -BAND_PITIES; pity--) levels.push(pity * PITY);
  return levels;
}

/**
 * The favourited banner appearances to plot as dots — the **list-twin of the
 * bookmarks**: only favourited banners (`favourites[key]` present), only future
 * (start on/after `now`), at their appearance date (`start`). Reuses the
 * `bundle.all()` + banner-type filter shape from the above-lane selector.
 */
export function dotMarks(bundle: Bundle, favourites: Favourites, now: CalendarDate): DotMark[] {
  const marks: DotMark[] = [];
  for (const ev of bundle.all()) {
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    if (ev.start < now) continue; // future-only, mirroring the bookmarks
    if (!(ev.key in favourites)) continue;
    marks.push({ date: ev.start, kind: ev.type });
  }
  return marks;
}
