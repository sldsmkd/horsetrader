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
 *   - computes the true-date x off the axis at the event's `start` — when it
 *     *arrives* on the timeline. (The reward still posts on `end` in the ledger;
 *     the card shows up when the event lands, "the line lags the dots".)
 */

import type { Projection, ResourceVector } from "../../core/projection/index.ts";
import type { Axis } from "../axis.ts";
import type { Bundle, EventRecord } from "../bundle/access.ts";

/** The below-lane (income / "doing") event kinds — everything that isn't a
 *  banner (trainee/support, the two above-lane kinds). */
export type BelowKind =
  | "cm"
  | "story"
  | "scenario"
  | "anchor"
  | "anchoredevent"
  | "mission"
  | "legendrace"
  | "factorstudies"
  | "skilltest"
  | "strongestteam"
  | "masterschallenge"
  | "racingcarnival"
  | "showtime"
  | "leagueofheroes";
const BELOW_LANE = new Set<string>([
  "cm",
  "story",
  "scenario",
  "anchor",
  "anchoredevent",
  "mission",
  "legendrace",
  "factorstudies",
  "skilltest",
  "strongestteam",
  "masterschallenge",
  "racingcarnival",
  "showtime",
  "leagueofheroes",
]);

export interface BelowCard {
  /** The event key — the stable id, used as the card's identity. */
  key: string;
  /** The event kind → the per-type left-border accent (ui.md principle 5). */
  kind: BelowKind;
  /** Display name, falling back to the key when the source carries none. */
  label: string;
  /** The arrival date — when the event shows up on the timeline; the stem's true
   *  date (principle 4). The reward still posts on `end` in the ledger. */
  date: string;
  /** Content-space x for `date` off the axis (true-to-date, principle 2). */
  x: number;
  /** Predicted dates trust less — the grey grammar (principle 5). */
  predicted: boolean;
  /** This event's own attributed reward delta (its height/breakdown signal). */
  reward: ResourceVector;
}

/** The display name for an event; the `name`/`title` it carries, else its key. */
function labelOf(ev: EventRecord): string {
  if ("name" in ev && ev.name) return ev.name;
  if ("title" in ev && ev.title) return ev.title;
  return ev.key;
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

  // Placeholder backfill: the reward-less below-lane kinds (PvP, scenario
  // generators, most anchors) produce no events-stream entry, so they'd never
  // get a card. Give each an empty reward so every kind is *present* on the lane
  // for packing; the real reward stays the height signal where one exists.
  // TODO(4e+): proper reward-less card rendering instead of a zero placeholder.
  for (const ev of bundle.all()) {
    if (!BELOW_LANE.has(ev.type)) continue; // above-lane banner
    if (!rewardBySource.has(ev.key)) rewardBySource.set(ev.key, {});
  }

  const cards: BelowCard[] = [];
  for (const [key, reward] of rewardBySource) {
    const ev = bundle.event(key); // resolves or throws — sources are bundle keys (ETL-guaranteed)
    if (!BELOW_LANE.has(ev.type)) continue; // an above-lane banner — handled later
    cards.push({
      key,
      kind: ev.type as BelowKind,
      label: labelOf(ev),
      date: ev.start,
      x: axis.xForDate(ev.start),
      predicted: ev.predicted,
      reward,
    });
  }
  cards.sort((a, b) => a.x - b.x); // left-to-right, i.e. by date
  return cards;
}
