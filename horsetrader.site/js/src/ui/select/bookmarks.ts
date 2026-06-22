/**
 * The bookmarks selector (view-model): `(bundle, favourites) → favourited atoms
 * with their future banner appearances`. Pure and DOM-free — it knows favourites
 * and banner contents, nothing about the drawer's pixels.
 *
 * It is the **list-twin of the minimap's favourite pips** (ui.md "Bookmarks"):
 * both are views over the one favourites map. Favourites are keyed by **atom
 * stable id** (the starred content card, an entry in `ev.contents`), not the
 * banner key — so a banner is bookmarked when *any* of its contents is starred.
 * Co-occurring favourites (atoms landing on the same beat → the same `start`)
 * now hang off the atom instead of replacing it: the bookmark surface leads with
 * the thing the player starred, then says where it appears.
 *
 * Future-only by design: past instances are dropped from the *navigation view*
 * ("it's gone; the player doesn't care about the past"). This is a view filter,
 * not data culling — the engine still holds the past (see projection.md).
 */

import type { Bundle } from "../bundle/access.ts";
import type { Favourites } from "../../core/persistence/document.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import type { BannerKind, RarityTier } from "./aboveLane.ts";
import { atomImage } from "./aboveLane.ts";
import { favouriteBannerAppearances } from "./favourites.ts";

export interface BookmarkAppearance {
  /** The banner appearance date — the warp target. */
  date: CalendarDate;
  /** The concrete banner containing this favourite. */
  eventKey: string;
  /** Predicted banners carry the grey trust-language. */
  predicted: boolean;
}

/** One bookmark row: the favourited atom first, with future appearances attached. */
export interface BookmarkRow {
  id: string;
  kind: BannerKind;
  name: string;
  subtext: string;
  rarity: string;
  rarityTier: RarityTier;
  image: string | null;
  attribute?: string;
  appearances: BookmarkAppearance[];
}

const NAME_ORDER = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function titleCase(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function knownFavouriteKinds(bundle: Bundle, favourites: Favourites): Map<string, BannerKind> {
  const kinds = new Map<string, BannerKind>();
  for (const { id } of bundle.trainees()) {
    if (id in favourites) kinds.set(id, "trainee");
  }
  for (const { id } of bundle.supports()) {
    if (id in favourites) kinds.set(id, "support");
  }
  return kinds;
}

function rowFor(bundle: Bundle, id: string, kind: BannerKind): BookmarkRow | null {
  if (kind === "trainee") {
    const trainee = bundle.trainee(id);
    if (trainee.rarity < 2) return null;
    const character = bundle.character(trainee.character);
    const name = character.name ?? id;
    const subtext = [`${trainee.rarity}★`, trainee.variant].filter(Boolean).join(" · ");
    return {
      id,
      kind,
      name,
      subtext,
      rarity: `${trainee.rarity}★`,
      rarityTier: trainee.rarity >= 3 ? "crystal" : "gold",
      image: atomImage(bundle, kind, id),
      appearances: [],
    };
  }

  const support = bundle.support(id);
  const rarity = (support.rarity ?? "").toLowerCase();
  if (rarity === "r" || rarity === "") return null;
  const character = support.character ? bundle.character(support.character) : null;
  const name = support.display ?? character?.name ?? id;
  const rarityLabel = rarity.toUpperCase();
  const subtext = [rarityLabel, titleCase(support.type), support.title].filter(Boolean).join(" · ");
  return {
    id,
    kind,
    name,
    subtext,
    rarity: rarityLabel,
    rarityTier: rarity === "ssr" ? "crystal" : "gold",
    image: atomImage(bundle, kind, id),
    ...(support.type ? { attribute: support.type } : {}),
    appearances: [],
  };
}

/**
 * The bookmark rows: every favourited atom with at least one future banner
 * appearance, sorted by nearest appearance and then name. The atom is the row's
 * identity; dates are attached navigation targets.
 */
export function bookmarkRows(bundle: Bundle, favourites: Favourites, now: CalendarDate): BookmarkRow[] {
  const rows = new Map<string, BookmarkRow>();
  for (const [id, kind] of knownFavouriteKinds(bundle, favourites)) {
    const row = rowFor(bundle, id, kind);
    if (row) rows.set(id, row);
  }

  for (const appearance of favouriteBannerAppearances(bundle, favourites, now)) {
    for (const id of appearance.atomIds) {
      const row = rows.get(id);
      if (!row || row.kind !== appearance.kind) continue;
      row.appearances.push({ date: appearance.date, eventKey: appearance.eventKey, predicted: appearance.predicted });
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, appearances: row.appearances.sort((a, b) => a.date.localeCompare(b.date)) }))
    .filter((row) => row.appearances.length > 0)
    .sort((a, b) => a.appearances[0]!.date.localeCompare(b.appearances[0]!.date) || NAME_ORDER.compare(a.name, b.name));
}

/** The cyclic navigation target for a bookmark card: first appearance after the
 * current view centre, wrapping to the first known appearance when the view is
 * already past the row's horizon. */
export function nextBookmarkDate(row: BookmarkRow, current: CalendarDate): CalendarDate | null {
  return row.appearances.find((appearance) => appearance.date > current)?.date ?? row.appearances[0]?.date ?? null;
}
