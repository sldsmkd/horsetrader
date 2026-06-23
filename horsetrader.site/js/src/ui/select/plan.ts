/**
 * The plan selector (view-model): `(bundle, statuses, isFavourited) → PlanRow[]`.
 *
 * The Desk's row source — the readable whole-plan rendering The Cover is about
 * (twinkle-monthly/cover.md). Where the film strip compresses every favourite +
 * commitment into ordinal squares, the plan is the **committed set only**, one row
 * per banner, sorted along the time spine. It reads the coordinator's cached
 * `commitmentStatuses` (the same funding fact the strip + badge read) so a row can
 * never disagree with the rest of the site.
 *
 * Pure and CSS-free: the row carries the raw affordability inputs (pity / unfundable /
 * wasteAbove) and the view derives the colour through the shared `commitmentBadge`
 * (the same box + `pityBand` rule the banners use). This is the discovery-phase floor —
 * see twinkle-monthly/desk-discovery.md; the row will grow what it turns out to need.
 */

import type { Bundle } from "../bundle/access.ts";
import type { CommitmentStatus } from "../../core/projection/pulls.ts";
import { atomOf, compareAtoms, PITY_WASTE_ABOVE, type BannerAtom, type BannerKind } from "./aboveLane.ts";
import { bannerForecast } from "./commit.ts";
import type { ForecastInput } from "./forecast.ts";

/** One committed banner, as the Desk reads it. A banner carries no baked display
 *  name (the dossier identifies it by its featured cards + window), so the row's
 *  handle is the lead featured atom + a count of the rest. */
export interface PlanRow {
  key: string;
  kind: BannerKind;
  /** The banner's human handle: lead featured atom name, `+N` when more follow. */
  label: string;
  /** The banner's featured atoms — favourites first, then by rarity, capped to MAX_CHIPS.
   *  Rendered as portrait chips (favourite + inspect → card surface). */
  contents: BannerAtom[];
  start: string;
  end: string;
  /** The committed pity (the spend target). */
  pity: number;
  /** Affordability inputs for the shared commitment badge — it derives the band colour
   *  itself via `pityBand`, the same way the banner card does. */
  unfundable: boolean;
  wasteAbove: number;
  /** The outcome distribution this commitment buys — the same model the dossier's
   *  Forecast uses (`bannerForecast` + the committed pity), drawn compact per row. */
  forecast: ForecastInput;
}

/** The Desk shows at most this many chips per row — the rest are dropped (favourites +
 *  highest rarity survive the sort below), keeping every row's content column uniform. */
export const MAX_CHIPS = 4;

export function planRows(
  bundle: Bundle,
  statuses: ReadonlyMap<string, CommitmentStatus>,
  isFavourited: (id: string) => boolean,
): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const [key, status] of statuses) {
    const ev = bundle.event(key);
    // commitmentStatuses only holds banners (pity > 0), but narrow for the types.
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    const contents = ev.contents
      .map((id) => atomOf(bundle, ev.type, id))
      .filter((a): a is BannerAtom => !!a)
      // ORDER BY favourited DESC, rarity, name — then cap, so the kept chips are the
      // ones the planner cares about (their stars) and the strongest cards.
      .sort((a, b) => Number(isFavourited(b.id)) - Number(isFavourited(a.id)) || compareAtoms(a, b))
      .slice(0, MAX_CHIPS);
    const names = contents.map((a) => a.name);
    const label = names.length === 0 ? "(banner)" : names.length === 1 ? names[0]! : `${names[0]!} +${names.length - 1}`;
    const forecast: ForecastInput = { ...bannerForecast(bundle, key), pity: status.pity };
    rows.push({
      key,
      kind: ev.type,
      label,
      contents,
      start: ev.start,
      end: ev.end,
      pity: status.pity,
      unfundable: status.unfundable,
      wasteAbove: PITY_WASTE_ABOVE[ev.type],
      forecast,
    });
  }
  // Time spine — the discovery doc's leaning hypothesis (band stays a signal, not a sort).
  return rows.sort((a, b) => a.start.localeCompare(b.start));
}
