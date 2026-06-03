/**
 * The first selector (view-model): `(projection, bundle, axis) → below-lane card
 * props`. This is the "bridging logic" layer of the cake (docs/frontend/
 * interaction.md) — pure, DOM-free, and therefore where view-layer correctness
 * is proven with core-grade tests, ahead of any card rendering in 4d.
 *
 * Below the line is the P&L *sources* axis (ui.md principle 3): CMs, stories,
 * scenarios, anchored events — "what I'm doing / what generates income". Each is
 * a single atom on its own true date (principle 4). The selector:
 *   - reads the ledger's `events`-stream facts and groups them by `source` (=
 *     event key) into each event's own attributed reward — the card's signal,
 *     not the whole day's subtotal;
 *   - resolves each key to its bundle event (its kind → accent, name, predicted);
 *   - keeps only the below-lane kinds (banners are above-lane, handled later);
 *   - computes the true-date x off the axis (posting date = the event's `end`,
 *     the realised moment the ledger fact and balance reaction both sit on).
 */

import type { Projection, ResourceVector } from "../../core/projection/index.ts";
import type { Axis } from "../axis.ts";
import type { Bundle, EventRecord } from "../bundle/access.ts";

/** The below-lane (income / "doing") event kinds — banners (trainee/support) are above. */
export type BelowKind = "cm" | "story" | "scenario" | "anchor" | "anchoredevent";
const BELOW_LANE = new Set<string>(["cm", "story", "scenario", "anchor", "anchoredevent"]);

export interface BelowCard {
  /** The event key — the stable id, used as the card's identity. */
  key: string;
  /** The event kind → the per-type left-border accent (ui.md principle 5). */
  kind: BelowKind;
  /** Display name, falling back to the key when the source carries none. */
  label: string;
  /** The posting date — the stem's true date (principle 4). */
  date: string;
  /** Content-space x for `date` off the axis (true-to-date, principle 2). */
  x: number;
  /** Predicted dates trust less — the grey grammar (principle 5). */
  predicted: boolean;
  /** This event's own attributed reward delta (its height/breakdown signal). */
  reward: ResourceVector;
}

/** The display name for an event, by kind; `undefined`/`null` falls back to its key. */
function labelOf(ev: EventRecord): string {
  switch (ev.type) {
    case "cm":
    case "anchoredevent":
      return ev.name ?? ev.key;
    case "story":
    case "scenario":
      return ev.title ?? ev.key;
    default:
      return ev.key;
  }
}

export function belowLaneCards(projection: Projection, bundle: Bundle, axis: Axis): BelowCard[] {
  // Each below-lane event posts once (on its `end`), so a source maps to one
  // reward bag; accumulate per source across its single-resource ledger entries.
  const rewardBySource = new Map<string, ResourceVector>();
  for (const entry of projection.ledger) {
    if (entry.stream !== "events") continue; // generators/sequences (logins) resolve differently — later
    let bag = rewardBySource.get(entry.source);
    if (!bag) rewardBySource.set(entry.source, (bag = {}));
    bag[entry.resource] = (bag[entry.resource] ?? 0) + entry.amount;
  }

  const cards: BelowCard[] = [];
  for (const [key, reward] of rewardBySource) {
    const ev = bundle.event(key); // resolves or throws — sources are bundle keys (ETL-guaranteed)
    if (!BELOW_LANE.has(ev.type)) continue; // an above-lane banner — handled later
    cards.push({
      key,
      kind: ev.type as BelowKind,
      label: labelOf(ev),
      date: ev.end,
      x: axis.xForDate(ev.end),
      predicted: ev.predicted,
      reward,
    });
  }
  cards.sort((a, b) => a.x - b.x); // left-to-right, i.e. by date
  return cards;
}
