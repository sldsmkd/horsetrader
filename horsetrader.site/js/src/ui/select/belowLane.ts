/**
 * The first selector (view-model): `(settled world, axis) → below-lane card
 * props`. This is the "bridging logic" layer of the cake (docs/frontend/
 * interaction.md) — pure, DOM-free, and therefore where view-layer correctness
 * is proven with core-grade tests, ahead of any card rendering in 4d.
 *
 * Below the line is the P&L *sources* axis (ui.md principle 3): CMs, stories,
 * scenarios, holidays — "what I'm doing / what generates income". Each is
 * a single atom on its own true date (principle 4). The selector reads the
 * engine's settled world (`coordinator.settledEvents()`), never the raw bundle:
 *   - a card's existence is a settled event's *presence* — the owning stream
 *     already applied both gates (the bake's `visible: false` opt-out and the
 *     play-style presence gate, e.g. missions off → no mission events at all),
 *     so the lane filter is just `visible` + below-lane kind;
 *   - the card's reward is the event's **resolved face** (`rewards`), stamped
 *     by the owning stream — no ledger join, no second lookup. Minted cadence
 *     children (`<parent-key>-<date>`, `visible: false`) fold back onto their
 *     parent's card so a sequence/generator facet still shows as the card's
 *     height/breakdown signal;
 *   - computes the true-date x off the axis at the event's `start` — when it
 *     *arrives* on the timeline. (The reward still posts on `end` in the ledger;
 *     the card shows up when the event lands, "the line lags the dots".)
 */

import type { SettledEvent } from "../../core/engine/index.ts";
import type { ResourceVector, CalendarDate } from "../../core/projection/index.ts";
import { isRushable } from "../../core/bundle/flags.ts";
import type { Axis } from "../axis.ts";
import type { Bundle } from "../bundle/access.ts";
import { atomOf, type BannerAtom } from "./aboveLane.ts";

/** The below-lane (income / "doing") event kinds — everything that isn't a
 *  banner (trainee/support, the two above-lane kinds). */
export type BelowKind =
  | "cm"
  | "story"
  | "mainstory"
  | "scenario"
  | "holiday"
  | "mission"
  | "anniversary"
  | "anniversarymission"
  | "scenariomission"
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
  "mainstory",
  "scenario",
  "holiday",
  "mission",
  "anniversary",
  "anniversarymission",
  "scenariomission",
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
  /** Full source display name, for hover/tooltips when `label` is compacted. */
  fullLabel: string;
  /** The arrival date — when the event shows up on the timeline; the stem's true
   *  date (principle 4). The reward still posts on `end` in the ledger. */
  date: CalendarDate;
  /** The event's live-window end date, separate from the reward posting semantics. */
  end: CalendarDate;
  /** Content-space x for `date` off the axis (true-to-date, principle 2). */
  x: number;
  /** Predicted dates trust less — the grey grammar (principle 5). */
  predicted: boolean;
  /** Past cards recede; planning-relevant content is ahead. */
  past: boolean;
  /** True when the event is rush-eligible and not yet ended. */
  rushable: boolean;
  /** Optional compact banner art for story/event cards. */
  banner: string | null;
  /** Optional transparent badge/logo art for mission-shaped cards. */
  image: string | null;
  /** Compact mission-art card: art carries identity, full label remains a tooltip. */
  compact: boolean;
  /** This event's resolved reward face (its height/breakdown signal). */
  reward: ResourceVector;
  /** Resolved content atoms — a story's distinct welfare support grant (the same
   *  pill grammar as banner contents). Empty for every other below-lane kind. */
  contents: BannerAtom[];
}

/** A below-lane event's welfare grant resolved to display atoms. Stories grant their
 *  Event Support Cards and anniversary missions their Part-2 anniversary card (all
 *  supports); a main-story chapter grants a support/trainee MIX (the finale ★3), so
 *  each id is resolved by its own `support-`/`trainee-` prefix. R/empty atoms cull. */
function contentsOf(record: NonNullable<SettledEvent["record"]>, bundle: Bundle): BannerAtom[] {
  if (record.type === "mainstory") {
    return record.contents
      .map((id) => atomOf(bundle, id.startsWith("trainee-") ? "trainee" : "support", id))
      .filter((a): a is BannerAtom => a !== null);
  }
  if (record.type !== "story" && record.type !== "anniversarymission") return [];
  return record.contents
    .map((id) => atomOf(bundle, "support", id))
    .filter((a): a is BannerAtom => a !== null);
}

/** The display name for an event; the `name`/`title` it carries, else its key. */
function labelOf(record: NonNullable<SettledEvent["record"]>): string {
  if ("name" in record && record.name) return record.name;
  if ("title" in record && record.title) return record.title;
  return record.key;
}

function compactAnniversaryMissionLabel(record: Extract<NonNullable<SettledEvent["record"]>, { type: "anniversarymission" }>, label: string): string {
  const ann = label.match(/^(.+?)\s+Anniversary\b/);
  const version = ann ? `${ann[1]} Anniversary` : "Anniversary";
  return `${version} Part ${record.part}`;
}

function g1MissionRaceName(label: string): string | null {
  const g1 = label.match(/^(?:(?:Spring|Fall)\s+)?G1\s+Celebration\s+Missions(?:,?\s*Part\s+\d+)?(?::|\s+)(.+)$/);
  const race = g1?.[1]?.trim();
  return race || null;
}

function compactG1RaceName(race: string): string {
  return race
    .replace(/\bQueen Elizabeth II\b/g, "QEII")
    .replace(/\bChampionship\b/g, "Ch.")
    .replace(/\bStakes\b/g, "S.");
}

function compactRegularMissionLabel(label: string): string {
  const race = g1MissionRaceName(label);
  if (race) return compactG1RaceName(race);

  return label.replace(/\s+Missions$/, "").trim();
}

function cardLabelOf(record: NonNullable<SettledEvent["record"]>, fullLabel: string): string {
  if (record.type === "anniversarymission") return compactAnniversaryMissionLabel(record, fullLabel);
  if (record.type === "mission" || record.type === "scenariomission") return compactRegularMissionLabel(fullLabel);
  return fullLabel;
}

function bannerOf(record: NonNullable<SettledEvent["record"]>): string | null {
  return "banner" in record ? record.banner : null;
}

function missionImageOf(record: NonNullable<SettledEvent["record"]>): string | null {
  return (
    (record.type === "mission" || record.type === "anniversarymission" || record.type === "scenariomission")
    && "image" in record
    && record.image
  ) ? record.image : null;
}

function compactMissionArtOf(record: NonNullable<SettledEvent["record"]>, label: string): boolean {
  return record.type === "mission" && g1MissionRaceName(label) !== null;
}

/** A minted cadence child's parent key — strip the `-<date>` mint suffix
 *  (rules/settle.ts keys children `<parent-key>-YYYY-MM-DD`); null otherwise. */
function cadenceParent(key: string): string | null {
  const m = /^(.+)-\d{4}-\d{2}-\d{2}$/.exec(key);
  return m ? m[1] : null;
}

export function belowLaneCards(events: readonly SettledEvent[], bundle: Bundle, axis: Axis, now: CalendarDate): BelowCard[] {
  // First pass: the visible below-lane events become cards, faces read straight
  // off the settled event. Presence is the stream's call (a play gate already
  // removed what the player doesn't do); the lane only filters lane-visibility.
  const cards: BelowCard[] = [];
  const byKey = new Map<string, BelowCard>();
  for (const ev of events) {
    if (!ev.visible) continue; // ledger-only cadence, or the bake's opt-out
    if (!BELOW_LANE.has(ev.type)) continue; // above-lane banner or unknown kind
    const record = ev.record;
    if (!record) continue; // minted events are never lane cards
    const fullLabel = labelOf(record);
    const banner = bannerOf(record);
    const image = missionImageOf(record);
    const card: BelowCard = {
      key: ev.key,
      kind: ev.type as BelowKind,
      label: cardLabelOf(record, fullLabel),
      fullLabel,
      date: ev.start,
      end: ev.end,
      x: axis.xForDate(ev.start),
      predicted: record.predicted,
      past: ev.end < now,
      // Completion is a statement about an event the trainer can be playing now,
      // not a promise about a future event or an edit to settled history.
      rushable: isRushable(record) && ev.start <= now && ev.end >= now,
      banner,
      image,
      compact: image !== null && compactMissionArtOf(record, fullLabel),
      reward: { ...ev.rewards },
      contents: contentsOf(record, bundle),
    };
    cards.push(card);
    byKey.set(card.key, card);
  }

  // Second pass: fold each minted cadence child's face onto its parent's card —
  // a sequence/generator facet is still *this event's* income. Children whose
  // parent isn't a card (a synthesiser's mint, a hidden parent) carry no card.
  for (const ev of events) {
    if (ev.record !== null) continue; // claimed events were handled above
    const parent = cadenceParent(ev.key);
    const card = parent === null ? undefined : byKey.get(parent);
    if (!card) continue;
    for (const [resource, amount] of Object.entries(ev.rewards)) {
      card.reward[resource] = (card.reward[resource] ?? 0) + amount;
    }
  }

  cards.sort((a, b) => a.x - b.x); // left-to-right, i.e. by date
  return cards;
}
