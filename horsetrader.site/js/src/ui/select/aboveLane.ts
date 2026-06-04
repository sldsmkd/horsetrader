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

export type BannerKind = "trainee" | "support";

/** Within a group, trainee gacha read before support gacha (the prototype order). */
const KIND_ORDER: Record<BannerKind, number> = { trainee: 0, support: 1 };

/** One resolved banner-content pill — the borrowed rarity/attribute grammar (principle 5). */
export interface BannerAtom {
  id: string;
  name: string;
  /** A display rarity token — trainee stars (`3★`) or support tier (`SSR`). */
  rarity: string;
}

/** One banner within a group — its identity, art and content pills. */
export interface Banner {
  key: string;
  kind: BannerKind;
  image: string;
  atoms: BannerAtom[];
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

/** Resolve one banner-content id to its display atom, by banner kind. */
function atomOf(bundle: Bundle, kind: BannerKind, id: string): BannerAtom {
  if (kind === "trainee") {
    const trainee = bundle.trainee(id);
    const character = bundle.character(trainee.character);
    return { id, name: character.name ?? id, rarity: `${trainee.rarity}★` };
  }
  const support = bundle.support(id);
  return { id, name: support.display ?? id, rarity: (support.rarity ?? "").toUpperCase() };
}

export function aboveLaneGroups(bundle: Bundle, axis: Axis): BannerGroup[] {
  // Every known banner, past and future — the timeline spans all known time, not
  // just the projection horizon (you scroll back into history too).
  const byDate = new Map<string, BannerGroup>();
  for (const ev of bundle.all()) {
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    let group = byDate.get(ev.start);
    if (!group) byDate.set(ev.start, (group = { key: ev.start, date: ev.start, x: axis.xForDate(ev.start), predicted: false, banners: [] }));
    group.predicted = group.predicted || ev.predicted;
    group.banners.push({ key: ev.key, kind: ev.type, image: ev.image, atoms: ev.contents.map((id) => atomOf(bundle, ev.type, id)) });
  }

  const groups = [...byDate.values()];
  for (const group of groups) group.banners.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  groups.sort((a, b) => a.x - b.x); // left-to-right, i.e. by appearance date
  return groups;
}
