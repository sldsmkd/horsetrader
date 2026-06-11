/**
 * The first selector (view-model): `(projection, bundle, axis) → below-lane card
 * props`. This is the "bridging logic" layer of the cake (docs/frontend/
 * interaction.md) — pure, DOM-free, and therefore where view-layer correctness
 * is proven with core-grade tests, ahead of any card rendering in 4d.
 *
 * Below the line is the P&L *sources* axis (ui.md principle 3): CMs, stories,
 * scenarios, anchored events — "what I'm doing / what generates income". Each is
 * a single atom on its own true date (principle 4). The selector:
 *   - iterates the bundle for the below-lane kinds — a card's existence is the
 *     event's *appearance* (its `start`), mirroring the above-lane selector, not
 *     whether it posted a reward. Most below-lane kinds (CMs, PvP, scenarios,
 *     anchors) grant nothing and still get a card. Visibility is **opt-out**:
 *     only an explicit `visible: false` hides a card; absence means visible;
 *   - attaches each event's own attributed reward from the ledger's `events`-
 *     and `sequence`-stream facts — the card's height/breakdown signal, not the
 *     whole day's subtotal, and `{}` for the (many) kinds that grant nothing.
 *     The flat discrete payout (`events`, on `end`) and the baked per-day
 *     sequence (`sequence`, anchored at `start`) share the event's key as their
 *     source, so both fold onto the one card; the `generator` stream (the global
 *     daily login) is *not* event-attributed and stays off the cards;
 *   - computes the true-date x off the axis at the event's `start` — when it
 *     *arrives* on the timeline. (The reward still posts on `end` in the ledger;
 *     the card shows up when the event lands, "the line lags the dots".)
 */

import type { Projection, ResourceVector, CalendarDate } from "../../core/projection/index.ts";
import { isVisible, isRushable } from "../../core/bundle/flags.ts";
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
  | "anniversary"
  | "anniversarymission"
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
  "anniversary",
  "anniversarymission",
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
  date: CalendarDate;
  /** Content-space x for `date` off the axis (true-to-date, principle 2). */
  x: number;
  /** Predicted dates trust less — the grey grammar (principle 5). */
  predicted: boolean;
  /** True when the event is rush-eligible and not yet ended. */
  rushable: boolean;
  /** This event's own attributed reward delta (its height/breakdown signal). */
  reward: ResourceVector;
}

/** The display name for an event; the `name`/`title` it carries, else its key. */
function labelOf(ev: EventRecord): string {
  if ("name" in ev && ev.name) return ev.name;
  if ("title" in ev && ev.title) return ev.title;
  return ev.key;
}

export function belowLaneCards(
  projection: Projection,
  bundle: Bundle,
  axis: Axis,
  now: CalendarDate,
  // Event kinds whose income stream the player has toggled off — their cards are
  // hidden entirely, not shown with an empty reward. A card belongs to its stream:
  // if you don't do missions, the mission cards leave the timeline with the income
  // (the play-style "missions" gate, the only member today). Distinct from the ETL
  // `visible: false` opt-out (a data fact); this is a live user-engagement choice.
  hiddenKinds: ReadonlySet<string> = new Set(),
): BelowCard[] {
  // Each below-lane event posts once (on its `end`), so a source maps to one
  // reward bag; accumulate per source across its single-resource ledger entries.
  // Many below-lane kinds post nothing — that's normal, not a missing card.
  const rewardBySource = new Map<string, ResourceVector>();
  for (const entry of projection.ledger) {
    // The event-attributed streams, all keyed by the event's key: `events` (flat
    // discrete payout), `sequence` (the baked per-day schedule, e.g. an anniversary
    // mission's daily carats), `missions` (the regular missions split onto their own
    // play-gated stream — see streams/missions.ts), and `story` (a story event's
    // play-style-graded reward bundle, selected from the baked reward map — see
    // streams/story.ts). The `generator` stream (daily login) is global income, not a
    // card's own reward, so it stays off.
    if (
      entry.stream !== "events" &&
      entry.stream !== "sequence" &&
      entry.stream !== "missions" &&
      entry.stream !== "story"
    )
      continue;
    let bag = rewardBySource.get(entry.source);
    if (!bag) rewardBySource.set(entry.source, (bag = {}));
    bag[entry.resource] = (bag[entry.resource] ?? 0) + entry.amount;
  }

  // The card's *existence* is the event's appearance, not a reward fact (the same
  // stance as the above-lane selector): scan the bundle, keep the below-lane kinds,
  // and attach the posted reward — `{}` where the event grants nothing.
  const cards: BelowCard[] = [];
  for (const ev of bundle.all()) {
    if (!BELOW_LANE.has(ev.type)) continue; // above-lane banner or unknown kind
    if (hiddenKinds.has(ev.type)) continue; // income stream toggled off → no card
    if (!isVisible(ev)) continue; // opt-out flag: explicit `visible: false` hides
    cards.push({
      key: ev.key,
      kind: ev.type as BelowKind,
      label: labelOf(ev),
      date: ev.start,
      x: axis.xForDate(ev.start),
      predicted: ev.predicted,
      rushable: isRushable(ev) && ev.end >= now,
      reward: rewardBySource.get(ev.key) ?? {},
    });
  }
  cards.sort((a, b) => a.x - b.x); // left-to-right, i.e. by date
  return cards;
}
