/**
 * The projection fold — `(snapshot, streams) → Projection`.
 *
 * One pure pass: attribute every stream's emissions into the rich ledger, then
 * derive the cached balance series from the snapshot forward. Deterministic and
 * side-effect-free. The result is an immutable value: scrubbing reads its
 * `series` (O(1) lookups, no refold), and "invalidate + regenerate" is just
 * calling `project` again with the changed inputs and swapping the value.
 *
 * Streams are independent, composable delta producers, so adding or removing a
 * reward source is a change to the `streams` list — never an edit to this fold.
 * See docs/frontend/projection.md.
 */

import type { Snapshot } from "../persistence/document.ts";
import { attribute, balanceSeries } from "./ledger.ts";
import type { BalanceSeries, Ledger, StreamEmission } from "./ledger.ts";

/** A stream's emissions tagged with its kind-name, ready to attribute. */
export interface NamedStream {
  stream: string;
  emissions: StreamEmission[];
}

/** The immutable result of one fold: the rich ledger and its scrub cache. */
export interface Projection {
  ledger: Ledger;
  series: BalanceSeries;
}

export function project(origin: Pick<Snapshot, "resources">, streams: NamedStream[]): Projection {
  const ledger: Ledger = streams.flatMap((s) => attribute(s.stream, s.emissions));
  const series = balanceSeries(origin.resources, ledger);
  return { ledger, series };
}
