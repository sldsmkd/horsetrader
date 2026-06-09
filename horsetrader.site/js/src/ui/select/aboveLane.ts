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

/**
 * "How many pulls do I have, from *carryable* sources?" — the zoomed-out ammo
 * count (ui.md): carats converted to pulls (at the baked `carats_per_pull` cost)
 * plus every ticket. Collapsed to one scalar because at this altitude *where* the
 * pulls come from doesn't matter, only that they exist. Free/gift `pulls` are
 * deliberately NOT here — they are banner-scoped (not a banked resource, see
 * streams/events.ts), so the banner adds its *own* `freePulls` on top. The
 * per-source breakdown lives in the commit shield.
 */
function pullsFrom(v: ResourceVector, caratsPerPull: number): number {
  const carats = (v.free_carats ?? 0) + (v.paid_carats ?? 0);
  const tickets = (v.trainee_tickets ?? 0) + (v.support_tickets ?? 0);
  return Math.floor(carats / caratsPerPull) + tickets;
}

/** The two live reads the above-lane readout folds in: balance-at-date and commitments. */
export interface AboveLaneInputs {
  /** The income fold surfaced at a spend point — `balanceAt(bannerDate)` (ui.md). */
  balanceAt: (date: string) => ResourceVector;
  /** Per-banner committed pities, keyed by banner key (the persisted plan). */
  commitments: Commitments;
}

const NO_INPUTS: AboveLaneInputs = { balanceAt: () => ({}), commitments: {} };

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
  const caratsPerPull = bundle.config().gacha.carats_per_pull;
  // The readout reads `balanceAt(appearance-date)` — the same value for every
  // banner sharing a date, so fold it once per group, not per banner.
  const pullsByDate = new Map<string, ResourceVector>();
  for (const ev of bundle.all()) {
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    let group = byDate.get(ev.start);
    if (!group) byDate.set(ev.start, (group = { key: ev.start, date: ev.start, x: axis.xForDate(ev.start), predicted: false, banners: [] }));
    group.predicted = group.predicted || ev.predicted;
    let balance = pullsByDate.get(ev.start);
    if (!balance) pullsByDate.set(ev.start, (balance = inputs.balanceAt(ev.start)));
    const atoms = ev.contents.map((id) => atomOf(bundle, ev.type, id)).filter((a): a is BannerAtom => a !== null);
    const open = ev.end >= now;
    // This banner's own free-pull grant. On banners `pulls` is always a plain
    // number, but the reward map is permissively typed — guard it.
    const freePulls = typeof ev.rewards?.pulls === "number" ? ev.rewards.pulls : 0;
    group.banners.push({
      key: ev.key,
      kind: ev.type,
      image: ev.image,
      atoms,
      rushable: isRushable(ev) && open,
      open,
      // Add the banner's own free pulls on top of the carryable ammo: they are
      // banner-scoped (never banked into `balance`, see streams/events.ts), so this
      // is what you'll actually have to spend *on this banner*. The standalone
      // `freePulls` line stays as the value signal.
      pullsAvailable: pullsFrom(balance, caratsPerPull) + freePulls,
      // The value signal — *this banner's own* free-pull count (ui.md), shown
      // separately even though it's now also part of the total above.
      freePulls,
      committedPity: inputs.commitments[ev.key] ?? null,
    });
  }

  const groups = [...byDate.values()];
  for (const group of groups) group.banners.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  groups.sort((a, b) => a.x - b.x); // left-to-right, i.e. by appearance date
  return groups;
}
