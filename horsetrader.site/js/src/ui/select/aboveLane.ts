/**
 * The above-lane selector (view-model): `(settled world, bundle, axis) → banner
 * groups`. Above the line is the P&L *sinks* axis (ui.md principle 3): the scout
 * banners you plan *for*. A banner's card is not a ledger fact — its presence is
 * its **appearance** (its `start`, the marketing beat) — so this reads the
 * settled world's banner events and resolves each banner's `contents` to its
 * academy atoms (the pills) through the bundle.
 *
 * Banners that share a start date are **grouped into one container** (trainee +
 * support gacha launching together): the group sits at the shared date, and the
 * packer nudges *groups* horizontally to fit. Pure and DOM-free — resolve ids,
 * group by date, compute true-date x; rendering and packing live downstream.
 */

import type { Axis } from "../axis.ts";
import type { Bundle } from "../bundle/access.ts";
import type { SettledEvent } from "../../core/engine/index.ts";
import type { ResourceVector } from "../../core/persistence/document.ts";
import { pullCapacity, bannerDays, bannerPullSources } from "../../core/projection/pulls.ts";
import type { CommitmentStatus } from "../../core/projection/pulls.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";

/** The live reads the above-lane readout folds in: balance-at-date and the
 *  per-event self-excluded available (both only needed to size *uncommitted*
 *  capacity), plus the coordinator's cached commitment funding state. */
export interface AboveLaneInputs {
  /** The income fold surfaced at a spend point — `balanceAt(bannerDate)` (ui.md). */
  balanceAt: (date: CalendarDate) => ResourceVector;
  /** A committed event's resources *before its own claim* (self-excluded — see
   *  project_spend_model); `undefined` when uncommitted, which reads the series. */
  availableFor: (eventKey: string) => ResourceVector | undefined;
  /** Cached funding state per committed banner (`coord.commitmentStatuses`) — the
   *  pity, fundability and post-commit capacity, derived once and shared. */
  commitmentStatuses: ReadonlyMap<string, CommitmentStatus>;
}

const NO_INPUTS: AboveLaneInputs = { balanceAt: () => ({}), availableFor: () => undefined, commitmentStatuses: new Map() };

export type BannerKind = "trainee" | "support";

/** Pity past which a commitment reads as overspend (the badge's purple band). A
 *  trainee's spark guarantees the featured copy at 1, so anything more is waste;
 *  a support card wants ~3 to reach a usable MLB before the same applies. */
export const PITY_WASTE_ABOVE: Record<BannerKind, number> = { trainee: 1, support: 3 };

/** A banner's "heat" tier — how much free-pull value it grants, driving the card's
 *  glow (bannerGroup.css `banner--hot-N`). Shared so any other view of a banner (the
 *  film strip) glows by the same rule. Closed banners read cold; the caller zeroes. */
export type HeatBand = 0 | 1 | 2 | 3 | 4;
export function bannerHeatBand(freePulls: number): HeatBand {
  if (freePulls <= 0) return 0;
  if (freePulls < 10) return 1;
  if (freePulls < 40) return 2;
  if (freePulls < 80) return 3;
  return 4;
}

/** Within a group, trainee gacha read before support gacha (the prototype order). */
const KIND_ORDER: Record<BannerKind, number> = { trainee: 0, support: 1 };
const NAME_ORDER = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Normalised rarity tier for the pill border grammar (principle 5). R is culled today, but silver remains part of the grammar. */
export type RarityTier = "crystal" | "gold" | "silver";
const RARITY_ORDER: Record<RarityTier, number> = { crystal: 0, gold: 1, silver: 2 };

/** One resolved banner-content pill — the borrowed rarity/attribute grammar (principle 5). */
export interface BannerAtom {
  id: string;
  name: string;
  /** A display rarity token — trainee stars (`3★`) or support tier (`SSR`). */
  rarity: string;
  /** Normalised tier for the border/surround grammar — crystal (SSR/3★) or gold (SR/2★). */
  rarityTier: RarityTier;
  /** Support type badge icon key — `"speed"`, `"guts"`, etc. Absent for trainees. */
  attribute?: string;
}

/** One banner within a group — its identity, art and content pills. */
export interface Banner {
  key: string;
  kind: BannerKind;
  image: string;
  atoms: BannerAtom[];
  /** Still open to pull — `end >= now`. A closed banner is gone: no readout at all. */
  open: boolean;
  /** Closed banners recede; planning-relevant content is ahead. */
  past: boolean;
  /** Pulls available from any source by the banner's appearance date (the ammo count). */
  pullsAvailable: number;
  /** Full-price pulls available from free carats. */
  freeCaratPulls: number;
  /** Discounted paid-carats pulls available during this banner's daily window. */
  paidCaratPulls: number;
  /** Kind-appropriate scout tickets available for this banner. */
  ticketPulls: number;
  /** Free pulls *this banner* grants — the banner's own `rewards.pulls`, the value signal (→ glow later). */
  freePulls: number;
  /** Committed spend in pities; null = no commitment (then no line renders). */
  committedPity: number | null;
  /** The commitment pushes the free-carat floor below zero. */
  commitmentUnfundable: boolean;
}

/** Banners sharing an appearance date, the unit the above-lane packer places. */
export interface BannerGroup {
  /** Group identity — the shared start date. */
  key: string;
  /** The appearance date — the stem's true date (principle 4). */
  date: CalendarDate;
  /** The latest close date across the group's banners — the range's far end. */
  end: CalendarDate;
  /** Content-space x for `date` off the axis (true-to-date, principle 2). */
  x: number;
  /** Any banner in the group predicted → the group reads as predicted. */
  predicted: boolean;
  /** All banners in the group are closed. */
  past: boolean;
  banners: Banner[];
}

/** Resolve one banner-content id to its display atom; returns null for R/1★ (culled by design). */
export function atomOf(bundle: Bundle, kind: BannerKind, id: string): BannerAtom | null {
  if (kind === "trainee") {
    const trainee = bundle.trainee(id);
    if (trainee.rarity < 2) return null;
    const character = bundle.character(trainee.character);
    return { id, name: character.name ?? id, rarity: `${trainee.rarity}★`, rarityTier: trainee.rarity >= 3 ? "crystal" : "gold" };
  }
  const support = bundle.support(id);
  const r = (support.rarity ?? "").toLowerCase();
  if (r === "r" || r === "") return null;
  return {
    id,
    name: support.display ?? id,
    rarity: r.toUpperCase(),
    rarityTier: r === "ssr" ? "crystal" : "gold",
    ...(support.type ? { attribute: support.type } : {}),
  };
}

/** An atom's portrait, by the shared precedence the bookmark drawer and film strip
 *  both read: the card's own art first (trainee thumbnail→portrait, support
 *  thumbnail→art), then the character's icon→portrait. Null when none exists. */
export function atomImage(bundle: Bundle, kind: BannerKind, id: string): string | null {
  if (kind === "trainee") {
    const trainee = bundle.trainee(id);
    const character = bundle.character(trainee.character);
    return trainee.thumbnail ?? trainee.portrait ?? character.icon ?? character.portrait;
  }
  const support = bundle.support(id);
  const character = support.character ? bundle.character(support.character) : null;
  return support.thumbnail ?? support.art ?? character?.icon ?? character?.portrait ?? null;
}

function compareAtoms(a: BannerAtom, b: BannerAtom): number {
  return RARITY_ORDER[a.rarityTier] - RARITY_ORDER[b.rarityTier] || NAME_ORDER.compare(a.name, b.name);
}

export function aboveLaneGroups(
  events: readonly SettledEvent[],
  bundle: Bundle,
  axis: Axis,
  now: CalendarDate,
  inputs: AboveLaneInputs = NO_INPUTS,
): BannerGroup[] {
  // Every known banner, past and future — the timeline spans all known time, not
  // just the projection horizon (you scroll back into history too).
  const byDate = new Map<string, BannerGroup>();
  const { carats_per_pull: caratsPerPull, paid_daily_pull: paidDailyPull } = bundle.config().gacha;
  for (const ev of events) {
    if (!ev.visible) continue; // ledger-only cadence, or the bake's opt-out
    const record = ev.record;
    if (!record || (record.type !== "trainee" && record.type !== "support")) continue;
    let group = byDate.get(ev.start);
    if (!group) byDate.set(ev.start, (group = { key: ev.start, date: ev.start, end: ev.end, x: axis.xForDate(ev.start), predicted: false, past: false, banners: [] }));
    group.predicted = group.predicted || record.predicted;
    if (ev.end > group.end) group.end = ev.end; // the range spans to the last banner to close
    // Ammo is measured at the banner's **end** (project_spend_model). A committed banner
    // reads its self-excluded available (income minus *earlier* claims, not its own); an
    // uncommitted one reads the series at its end (which already nets out earlier claims).
    const atoms = record.contents
      .map((id) => atomOf(bundle, record.type, id))
      .filter((a): a is BannerAtom => a !== null)
      .sort(compareAtoms);
    const open = ev.end >= now;
    // This banner's own free-pull grant — banner-scoped, never banked, so it lives
    // on the baked record, not the settled face (rules/settle.ts strips `pulls`).
    const freePulls = typeof record.rewards?.pulls === "number" ? record.rewards.pulls : 0;
    // Committed banners read their funding (pity / capacity-after-commit / fundability)
    // straight from the cache — the one home for the pull-math. Uncommitted banners
    // have no commitment to reserve, so the gutter sizes raw capacity off the live
    // balance here (each source floored at zero: you cannot use negative tickets).
    const status = inputs.commitmentStatuses.get(ev.key);
    let capacity = status?.capacity;
    if (!capacity) {
      const balance = inputs.availableFor(ev.key) ?? inputs.balanceAt(ev.end);
      capacity = pullCapacity(bannerPullSources(balance, record.type, freePulls), { caratsPerPull, paidDailyPull, bannerDays: bannerDays(ev.start, ev.end) });
    }
    group.banners.push({
      key: ev.key,
      kind: record.type,
      image: record.image,
      atoms,
      open,
      past: !open,
      pullsAvailable: capacity.total,
      freeCaratPulls: capacity.freeCaratPulls,
      paidCaratPulls: capacity.dailyPaid,
      ticketPulls: capacity.tickets,
      // The value signal — *this banner's own* free-pull count (ui.md), shown
      // separately even though it's also part of the total above.
      freePulls,
      committedPity: status?.pity ?? null,
      commitmentUnfundable: status?.unfundable ?? false,
    });
  }

  const groups = [...byDate.values()];
  for (const group of groups) {
    group.banners.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    group.past = group.banners.length > 0 && group.banners.every((banner) => banner.past);
  }
  groups.sort((a, b) => a.x - b.x); // left-to-right, i.e. by appearance date
  return groups;
}
