/**
 * Pure motion math for the timeline — stateless helpers the state machine composes:
 * date clamping, the warp easing curve + duration, and the overscroll rubber-band.
 * No DOM, no closure state; kept here so `timeline.ts` reads as orchestration.
 */

import type { CalendarDate } from "../../../core/projection/dates.ts";
import { RUBBER_TENSION, WARP_DISTANCE_SCALE_PX, WARP_MAX_MS, WARP_MIN_MS } from "./constants.ts";

/** Clamp a calendar date into `[lo, hi]` — lexical compare is correct for `YYYY-MM-DD`. */
export function clampDate(date: CalendarDate, [lo, hi]: readonly [CalendarDate, CalendarDate]): CalendarDate {
  return date < lo ? lo : date > hi ? hi : date;
}

/** Smootherstep (Ken Perlin's quintic) — zero first *and* second derivative at the
 *  ends, so a warp accelerates and settles without a velocity kink. */
export function easeInOutSmootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Warp duration from travel distance: short hops stay crisp, long jumps approach
 *  (never exceed) the max via an exponential distance curve. */
export function warpDuration(distancePx: number): number {
  const scaled = 1 - Math.exp(-Math.abs(distancePx) / WARP_DISTANCE_SCALE_PX);
  return WARP_MIN_MS + (WARP_MAX_MS - WARP_MIN_MS) * scaled;
}

/** Diminishing-returns overscroll: the further past a wall, the less it gives — an
 *  asymptote at `dim`, so the wall stiffens but never locks. */
export function rubber(over: number, dim: number): number {
  return (1 - 1 / ((over / (dim || 1)) * RUBBER_TENSION + 1)) * dim;
}
