/**
 * The above-lane selector (view-model): `(bundle, axis, after) → banner card
 * props`. Above the line is the P&L *sinks* axis (ui.md principle 3): the scout
 * banners you plan *for*. Unlike the below lane, a banner's card is not a ledger
 * fact — its presence is its **appearance** (its `start`, the marketing beat),
 * so this reads the bundle directly and resolves each banner's `contents` to its
 * academy atoms (the pills). The end-spend that hits the ledger is the lag; the
 * card sits at the appearance (ui.md "the line lags the dots").
 *
 * Pure and DOM-free, like its below-lane sibling — resolve ids, compute true-date
 * x off the shared axis, leave rendering to the view and packing to 4e.
 */

import type { Axis } from "../axis.ts";
import type { Bundle } from "../bundle/access.ts";

export type BannerKind = "trainee" | "support";

/** One resolved banner-content pill — the borrowed rarity/attribute grammar (principle 5). */
export interface BannerAtom {
  id: string;
  name: string;
  /** A display rarity token — trainee stars (`3★`) or support tier (`SSR`). */
  rarity: string;
}

export interface BannerCard {
  key: string;
  kind: BannerKind;
  /** The appearance date — the marketing beat, the stem's true date (principle 4). */
  date: string;
  /** Content-space x for `date` off the axis (true-to-date, principle 2). */
  x: number;
  image: string;
  predicted: boolean;
  atoms: BannerAtom[];
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

export function aboveLaneBanners(bundle: Bundle, axis: Axis, after: string): BannerCard[] {
  const cards: BannerCard[] = [];
  for (const ev of bundle.all()) {
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    if (ev.end <= after) continue; // already over before the horizon — out of scope (mirrors the ledger)
    cards.push({
      key: ev.key,
      kind: ev.type,
      date: ev.start,
      x: axis.xForDate(ev.start),
      image: ev.image,
      predicted: ev.predicted,
      atoms: ev.contents.map((id) => atomOf(bundle, ev.type, id)),
    });
  }
  cards.sort((a, b) => a.x - b.x); // left-to-right, i.e. by appearance date
  return cards;
}
