/**
 * The axis primitive: the pure date↔x mapping the whole timeline is built on.
 * x is true-to-date (ui.md principle 2) — a gap is a real gap, a cluster a real
 * cluster; spacing is the output, never event-order adjacency.
 *
 * This is a *presentation* concern, NOT projection: the px-per-day scale is a
 * fact about how you're *looking* at the plan, the same class as a theme — not a
 * fact about your account. So it lives in `ui/` beside `h()`/`format.ts` and
 * never in `core/`. See docs/frontend/interaction.md (build-order 4a).
 *
 * Pure and DOM-free. The pan offset is a separate CSS transform on the canvas
 * (transient interaction-state, the cheap path) and is deliberately NOT baked in
 * here: this maps a date to *content-space* x, and pan slides that content.
 */

import { addDays, daysBetween } from "../core/projection/dates.ts";

/**
 * What the mapping reads. `origin` is the date at content-x = 0; `pxPerDay` is
 * the zoom (discrete view-state). `pxPerDay` must be > 0.
 */
export interface AxisScale {
  origin: string;
  pxPerDay: number;
}

export interface Axis {
  /** Content-space x (px) for an ISO date. Exact; negative for dates before the origin. */
  xForDate(date: string): number;
  /** The ISO date whose tick is nearest a content-space x — for hit-testing the cursor. */
  dateForX(x: number): string;
}

/**
 * Build an axis from a scale. Pure: a zoom change makes a *new* axis rather than
 * mutating one, which is why the scale can live in the discrete view-state store
 * and re-renders fall out of the existing subscribe path.
 */
export function createAxis({ origin, pxPerDay }: AxisScale): Axis {
  return {
    xForDate: (date) => daysBetween(origin, date) * pxPerDay,
    dateForX: (x) => addDays(origin, Math.round(x / pxPerDay)),
  };
}
