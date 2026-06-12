/**
 * The one generic fold: settled world → money. Payment derivation exists ONCE,
 * here — pay an event's face at its `end`, at its `start` when rushed, and only
 * strictly after the snapshot origin (anything on or before it is already in
 * the reading; re-paying would double-count). Payment timing is unwritable in
 * streams (eclipse/2.DESIGN.md).
 *
 * The fold is LINEAR: `balance = base + Σ deltas`. No clamping, no min/max, no
 * balance-conditionals — negative free carats are allowed and meaningful.
 * Linearity + disjoint claims ⇒ streams commute; registry order means nothing.
 *
 * The ledger/series substrate is the shipped `core/projection` fold —
 * `attribute`/`balanceSeries` via `project()` — reused unchanged.
 */

import type { Snapshot } from "../persistence/document.ts";
import type { CalendarDate } from "../projection/dates.ts";
import { project } from "../projection/project.ts";
import type { NamedStream, Projection } from "../projection/project.ts";
import type { StreamEmission } from "../projection/ledger.ts";
import type { TaggedEvents } from "./stream.ts";

/** One stream's slice of the settled world, derived into dated emissions. */
function emissionsOf(events: TaggedEvents["events"], after: CalendarDate, rushed: ReadonlySet<string>): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  for (const event of events) {
    if (Object.keys(event.rewards).length === 0) continue; // an unpriced face folds nothing
    // Rushed → the discrete face is brought forward from `end` to `start`. Minted
    // children are single-day (start === end) and never rushable, so they're inert here.
    const date = rushed.has(event.key) ? event.start : event.end;
    if (date <= after) continue; // already banked in the snapshot reading
    emissions.push({ date, source: event.key, deltas: event.rewards });
  }
  return emissions;
}

/** Derive each stream's emissions from its settled events — reusable by the
 *  final flatten, so income attribution is computed once per fold. */
export function deriveEmissions(world: TaggedEvents[], after: CalendarDate, rushed: ReadonlySet<string>): NamedStream[] {
  return world.map((tagged) => ({ stream: tagged.stream, emissions: emissionsOf(tagged.events, after, rushed) }));
}

/** Fold tagged emissions into a projection from the snapshot reading. */
export function foldIncome(origin: Pick<Snapshot, "resources">, income: NamedStream[]): Projection {
  return project(origin, income);
}
