/**
 * The ledger and its folds — the composition layer of the projection engine.
 *
 * A stream emits dated `(source, deltas)` facts; the projection *attributes*
 * them into a flat list of single-resource `LedgerEntry` facts. Everything
 * visible is a fold over that list: per-date subtotals (the hover tooltip) and
 * the cumulative running balance (the cursor balance, the minimap line, the
 * spreadsheet's final column). Entries are facts; balances are always derived,
 * never stored. See docs/frontend/projection.md.
 *
 * The ledger is kept deliberately *rich* — one entry per (date, source,
 * resource) — so per-stream and per-source attribution survives for the tooltip
 * and "toggle this stream" what-ifs. Collapsing it is a lossy optimisation we
 * explicitly do not take yet.
 */

import type { ResourceVector } from "../persistence/document.ts";
import type { CalendarDate } from "./dates.ts";
import { addDays } from "./dates.ts";

export type { ResourceVector } from "../persistence/document.ts";

/**
 * One dated bag of signed resource deltas a stream emits. `source` identifies
 * the *specific* contributor (an event key, a banner spend id, a procedural
 * generator name) so attribution is preserved through the fold; a stream knows
 * its sources but not its own kind-name — the projection supplies that.
 */
export interface StreamEmission {
  date: CalendarDate;
  source: string;
  deltas: ResourceVector;
}

/**
 * One attributed, dated, signed fact — a single resource dimension. `stream` is
 * the kind ("events", "spends", …) for grouping/toggling; `source` is the
 * specific contributor for the tooltip. A single date carries many of these.
 */
export interface LedgerEntry {
  date: CalendarDate;
  stream: string;
  source: string;
  resource: string;
  amount: number;
}

export type Ledger = LedgerEntry[];

/**
 * Flatten one stream's emissions into attributed single-resource entries,
 * tagging each with the stream kind. Order is preserved; the cumulative fold
 * sorts when it needs to.
 */
export function attribute(stream: string, emissions: StreamEmission[]): Ledger {
  const entries: Ledger = [];
  for (const { date, source, deltas } of emissions) {
    for (const [resource, amount] of Object.entries(deltas)) {
      entries.push({ date, stream, source, resource, amount });
    }
  }
  return entries;
}

/** Add `delta` into `into` in place, per resource dimension. */
function accumulate(into: ResourceVector, delta: ResourceVector): void {
  for (const [resource, amount] of Object.entries(delta)) {
    into[resource] = (into[resource] ?? 0) + amount;
  }
}

/**
 * Per-date subtotal: the entries on each date summed per resource — what the
 * per-day hover tooltip shows. Sparse: only dates that carry entries appear.
 */
export function subtotals(ledger: Ledger): Map<CalendarDate, ResourceVector> {
  const byDate = new Map<CalendarDate, ResourceVector>();
  for (const { date, resource, amount } of ledger) {
    let vector = byDate.get(date);
    if (!vector) byDate.set(date, (vector = {}));
    vector[resource] = (vector[resource] ?? 0) + amount;
  }
  return byDate;
}

/**
 * The cumulative running balance, starting from a base reading (the snapshot).
 * The scrub cache: built once by the fold, queried O(1) by `balanceAt` on every
 * cursor move, never refolded.
 *
 * It is materialised *densely* — a balance for every calendar day across the
 * timeline's extent, carrying the running total across days with no entry. We do
 * not store sparse change-points and binary-search between them: daily rewards
 * make nearly every day a change-point anyway, so a dense `date → balance`
 * dictionary is both simpler and a flat O(1) lookup. `dates` still exposes the
 * change-points (the step risers) for views that want them; `extent` is the
 * dense range.
 */
export interface BalanceSeries {
  /** Sorted change-point dates — the dates where the balance actually moves. */
  readonly dates: readonly CalendarDate[];
  /** The dense range `[first, last]` (the change-point extent), or null if empty. */
  readonly extent: readonly [CalendarDate, CalendarDate] | null;
  /**
   * Balance at any cursor date — O(1). The base reading before the first
   * change-point; the final balance after the last; the dense per-day value in
   * between. A copy, safe to mutate.
   */
  balanceAt(date: CalendarDate): ResourceVector;
}

export function balanceSeries(base: ResourceVector, ledger: Ledger): BalanceSeries {
  const perDate = subtotals(ledger);
  const dates = [...perDate.keys()].sort();

  if (dates.length === 0) {
    return { dates, extent: null, balanceAt: () => ({ ...base }) };
  }

  const first = dates[0]!;
  const last = dates[dates.length - 1]!;

  const dense = new Map<CalendarDate, ResourceVector>();
  const running: ResourceVector = { ...base };
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const delta = perDate.get(date);
    if (delta) accumulate(running, delta);
    dense.set(date, { ...running });
  }

  function balanceAt(date: CalendarDate): ResourceVector {
    if (date < first) return { ...base };
    const hit = dense.get(date);
    if (hit) return { ...hit };
    return { ...dense.get(last)! }; // beyond the extent — hold the final balance
  }

  return { dates, extent: [first, last], balanceAt };
}
