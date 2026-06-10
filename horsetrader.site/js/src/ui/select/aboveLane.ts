/**
 * The above-lane selector (view-model): `(bundle, axis) → banner groups`. Above
 * the line is the P&L *sinks* axis (ui.md principle 3): the scout banners you plan
 * *for*. A banner's card is not a ledger fact — its presence is its **appearance**
 * (its `start`, the marketing beat) — so this reads the bundle directly and
 * resolves each banner's `contents` to its academy atoms (the pills).
 *
 * Banners that share a start date are **grouped into one container** (trainee +
 * support gacha launching together): the group sits at the shared date, and the
 * packer nudges *groups* horizontally to fit. Pure and DOM-free — resolve ids,
 * group by date, compute true-date x; rendering and packing live downstream.
 */

import type { Axis } from "../axis.ts";
import type { Bundle } from "../bundle/access.ts";
import { isRushable } from "../../core/bundle/flags.ts";
import type { ResourceVector, Commitments } from "../../core/persistence/document.ts";
import { pullCapacity, bannerDays } from "../../core/projection/pulls.ts";

/** The live reads the above-lane readout folds in: balance-at-date, the per-banner
 *  self-excluded available (for committed banners), and commitments. */
export interface AboveLaneInputs {
  /** The income fold surfaced at a spend point — `balanceAt(bannerDate)` (ui.md). */
  balanceAt: (date: string) => ResourceVector;
  /** A committed banner's resources *before its own spend* (self-excluded — see
   *  project_spend_model); `undefined` for an uncommitted banner, which reads the series. */
  bannerAvailable: (bannerKey: string) => ResourceVector | undefined;
  /** Per-banner committed pities, keyed by banner key (the persisted plan). */
  commitments: Commitments;
}

const NO_INPUTS: AboveLaneInputs = { balanceAt: () => ({}), bannerAvailable: () => undefined, commitments: {} };

export type BannerKind = "trainee" | "support";

/** Within a group, trainee gacha read before support gacha (the prototype order). */
const KIND_ORDER: Record<BannerKind, number> = { trainee: 0, support: 1 };

/** Normalised rarity tier for the pill border grammar (principle 5). R is culled — never silver. */
export type RarityTier = "crystal" | "gold";

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
  /** True when the event is rush-eligible and not yet ended. */
  rushable: boolean;
  /** Still open to pull — `end >= now`. A closed banner is gone: no readout at all. */
  open: boolean;
  /** Pulls available from any source by the banner's appearance date (the ammo count). */
  pullsAvailable: number;
  /** Free pulls *this banner* grants — the banner's own `rewards.pulls`, the value signal (→ glow later). */
  freePulls: number;
  /** Committed spend in pities; null = no commitment (then no line renders). */
  committedPity: number | null;
}

/** Banners sharing an appearance date, the unit the above-lane packer places. */
export interface BannerGroup {
  /** Group identity — the shared start date. */
  key: string;
  /** The appearance date — the stem's true date (principle 4). */
  date: string;
  /** Content-space x for `date` off the axis (true-to-date, principle 2). */
  x: number;
  /** Any banner in the group predicted → the group reads as predicted. */
  predicted: boolean;
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

export function aboveLaneGroups(bundle: Bundle, axis: Axis, now: string, inputs: AboveLaneInputs = NO_INPUTS): BannerGroup[] {
  // Every known banner, past and future — the timeline spans all known time, not
  // just the projection horizon (you scroll back into history too).
  const byDate = new Map<string, BannerGroup>();
  const { carats_per_pull: caratsPerPull, paid_daily_pull: paidDailyPull } = bundle.config().gacha;
  for (const ev of bundle.all()) {
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    let group = byDate.get(ev.start);
    if (!group) byDate.set(ev.start, (group = { key: ev.start, date: ev.start, x: axis.xForDate(ev.start), predicted: false, banners: [] }));
    group.predicted = group.predicted || ev.predicted;
    // Ammo is measured at the banner's **end** (project_spend_model). A committed banner
    // reads its self-excluded available (income minus *earlier* spends, not its own); an
    // uncommitted one reads the series at its end (which already nets out earlier spends).
    const balance = inputs.bannerAvailable(ev.key) ?? inputs.balanceAt(ev.end);
    const atoms = ev.contents.map((id) => atomOf(bundle, ev.type, id)).filter((a): a is BannerAtom => a !== null);
    const open = ev.end >= now;
    // This banner's own free-pull grant. On banners `pulls` is always a plain
    // number, but the reward map is permissively typed — guard it.
    const freePulls = typeof ev.rewards?.pulls === "number" ? ev.rewards.pulls : 0;
    // The effective pulls under the spend model: free pulls + kind-appropriate tickets
    // + duration-capped daily paid pulls + full-price free carats (shared with the
    // commit shield's reservation so card and shield never disagree).
    const capacity = pullCapacity(
      {
        freePulls,
        tickets: (ev.type === "support" ? balance.support_tickets : balance.trainee_tickets) ?? 0,
        freeCarats: balance.free_carats ?? 0,
        paidCarats: balance.paid_carats ?? 0,
      },
      { caratsPerPull, paidDailyPull, bannerDays: bannerDays(ev.start, ev.end) },
    );
    group.banners.push({
      key: ev.key,
      kind: ev.type,
      image: ev.image,
      atoms,
      rushable: isRushable(ev) && open,
      open,
      pullsAvailable: capacity.total,
      // The value signal — *this banner's own* free-pull count (ui.md), shown
      // separately even though it's also part of the total above.
      freePulls,
      committedPity: inputs.commitments[ev.key] ?? null,
    });
  }

  const groups = [...byDate.values()];
  for (const group of groups) group.banners.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  groups.sort((a, b) => a.x - b.x); // left-to-right, i.e. by appearance date
  return groups;
}
