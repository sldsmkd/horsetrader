/**
 * The bookmarks selector (view-model): `(bundle, favourites) → future banner
 * appearances that contain a favourited atom`, grouped by appearance date. Pure
 * and DOM-free — it knows favourites and banner contents, nothing about the
 * drawer's pixels.
 *
 * It is the **list-twin of the minimap's favourite pips** (ui.md "Bookmarks"):
 * both are views over the one favourites map. Favourites are keyed by **atom
 * stable id** (the starred content card, an entry in `ev.contents`), not the
 * banner key — so a banner is bookmarked when *any* of its contents is starred.
 * Co-occurring favourites (atoms landing on the same beat → the same `start`)
 * combine into one row, the marketing-beat grouping showing through.
 *
 * Future-only by design: past instances are dropped from the *navigation view*
 * ("it's gone; the player doesn't care about the past"). This is a view filter,
 * not data culling — the engine still holds the past (see projection.md).
 */

import type { Bundle } from "../bundle/access.ts";
import type { Favourites } from "../../core/persistence/document.ts";
import { atomOf } from "./aboveLane.ts";
import type { BannerAtom, BannerKind } from "./aboveLane.ts";

/** One favourited atom on a bookmark row — the resolved pill plus its banner kind (→ colour). */
export interface BookmarkAtom {
  atom: BannerAtom;
  kind: BannerKind;
}

/** One bookmark row: a future appearance beat carrying the favourited atoms that land on it. */
export interface BookmarkRow {
  /** The appearance date — the warp target and the row's heading. */
  date: string;
  /** Any contributing banner predicted → the row reads predicted (grey trust-language). */
  predicted: boolean;
  atoms: BookmarkAtom[];
}

/**
 * The bookmark rows: every future banner appearance holding a favourited atom,
 * one row per appearance date (sorted nearest-first), the favourited atoms within
 * it resolved to their display pills. Mirrors the above-lane walk (banner-type
 * filter, `atomOf` resolution) but keys the membership test on `ev.contents`
 * against the atom-keyed `favourites` map.
 */
export function bookmarkRows(bundle: Bundle, favourites: Favourites, now: string): BookmarkRow[] {
  const byDate = new Map<string, BookmarkRow>();
  for (const ev of bundle.all()) {
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    if (ev.start < now) continue; // future-only, mirroring the minimap dots
    for (const id of ev.contents) {
      if (!(id in favourites)) continue;
      const atom = atomOf(bundle, ev.type, id);
      if (!atom) continue; // culled rarity — never a starrable chip, but stay defensive
      let row = byDate.get(ev.start);
      if (!row) byDate.set(ev.start, (row = { date: ev.start, predicted: false, atoms: [] }));
      row.predicted = row.predicted || ev.predicted;
      row.atoms.push({ atom, kind: ev.type });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
