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

export type { ResourceVector } from "../persistence/document.ts";

/**
 * One dated bag of signed resource deltas a stream emits. `source` identifies
 * the *specific* contributor (an event key, a banner spend id, a procedural
 * generator name) so attribution is preserved through the fold; a stream knows
 * its sources but not its own kind-name — the projection supplies that.
 */
export interface StreamEmission {
  date: string;
  source: string;
  deltas: ResourceVector;
}

/**
 * One attributed, dated, signed fact — a single resource dimension. `stream` is
 * the kind ("events", "spends", …) for grouping/toggling; `source` is the
 * specific contributor for the tooltip. A single date carries many of these.
 */
export interface LedgerEntry {
  date: string;
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
export function subtotals(ledger: Ledger): Map<string, ResourceVector> {
  const byDate = new Map<string, ResourceVector>();
  for (const { date, resource, amount } of ledger) {
    let vector = byDate.get(date);
    if (!vector) byDate.set(date, (vector = {}));
    vector[resource] = (vector[resource] ?? 0) + amount;
  }
  return byDate;
}

/**
 * The cumulative running balance — a step function over the dates where the
 * balance actually changes, starting from a base reading (the snapshot). This
 * is the scrub cache: built once by the fold, queried O(log n) by `balanceAt`
 * on every cursor move, never refolded. There is no point stored for an empty
 * day; the balance holds flat between change-points.
 */
export interface BalanceSeries {
  /** Sorted change-point dates — the dates where the balance moves. */
  readonly dates: readonly string[];
  /** Running balance *at* each change-point (parallel to `dates`). */
  readonly balances: readonly ResourceVector[];
  /**
   * Balance at any cursor date: the last change-point ≤ `date`, or the base
   * reading if `date` precedes the first change-point. A copy, safe to mutate.
   */
  balanceAt(date: string): ResourceVector;
}

export function balanceSeries(base: ResourceVector, ledger: Ledger): BalanceSeries {
  const perDate = subtotals(ledger);
  const dates = [...perDate.keys()].sort();

  const running: ResourceVector = { ...base };
  const balances: ResourceVector[] = [];
  for (const date of dates) {
    accumulate(running, perDate.get(date)!);
    balances.push({ ...running });
  }

  function balanceAt(date: string): ResourceVector {
    let lo = 0;
    let hi = dates.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dates[mid]! <= date) lo = mid + 1;
      else hi = mid;
    }
    return lo === 0 ? { ...base } : { ...balances[lo - 1]! };
  }

  return { dates, balances, balanceAt };
}
