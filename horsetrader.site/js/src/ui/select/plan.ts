/**
 * The plan selector (view-model): `(bundle, statuses, bandFor) → PlanRow[]`.
 *
 * The Desk's row source — the readable whole-plan rendering The Cover is about
 * (twinkle-monthly/cover.md). Where the film strip compresses every favourite +
 * commitment into ordinal squares, the plan is the **committed set only**, one row
 * per banner, sorted along the time spine. It reads the coordinator's cached
 * `commitmentStatuses` (the same funding fact the strip + badge read) so a row can
 * never disagree with the rest of the site.
 *
 * Pure and CSS-free: the band *colour* is computed in the view layer (pityBand
 * imports CSS); the app hands it in through `bandFor`, exactly as the film strip
 * takes its band callback. This is the discovery-phase floor — see
 * twinkle-monthly/desk-discovery.md; the row will grow what it turns out to need.
 */

import type { Bundle } from "../bundle/access.ts";
import type { CommitmentStatus } from "../../core/projection/pulls.ts";
import { atomOf, type BannerKind } from "./aboveLane.ts";
import { bannerForecast } from "./commit.ts";
import type { ForecastInput } from "./forecast.ts";
import type { PityBand } from "../views/widgets/pityBand.ts"; // type-only: erased, no CSS side-effect

/** One committed banner, as the Desk reads it. A banner carries no baked display
 *  name (the dossier identifies it by its featured cards + window), so the row's
 *  handle is the lead featured atom + a count of the rest. */
export interface PlanRow {
  key: string;
  kind: BannerKind;
  /** The banner's human handle: lead featured atom name, `+N` when more follow. */
  label: string;
  start: string;
  end: string;
  /** The committed pity (the spend target). */
  pity: number;
  /** The affordability colour, handed in by the app (shared `pityBand` rule). */
  band: PityBand;
  /** The outcome distribution this commitment buys — the same model the dossier's
   *  Forecast uses (`bannerForecast` + the committed pity), drawn compact per row. */
  forecast: ForecastInput;
}

export function planRows(
  bundle: Bundle,
  statuses: ReadonlyMap<string, CommitmentStatus>,
  bandFor: (key: string) => PityBand,
): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const [key, status] of statuses) {
    const ev = bundle.event(key);
    // commitmentStatuses only holds banners (pity > 0), but narrow for the types.
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    const names = ev.contents
      .map((id) => atomOf(bundle, ev.type, id)?.name)
      .filter((n): n is string => !!n);
    const label = names.length === 0 ? "(banner)" : names.length === 1 ? names[0]! : `${names[0]!} +${names.length - 1}`;
    const forecast: ForecastInput = { ...bannerForecast(bundle, key), pity: status.pity };
    rows.push({ key, kind: ev.type, label, start: ev.start, end: ev.end, pity: status.pity, band: bandFor(key), forecast });
  }
  // Time spine — the discovery doc's leaning hypothesis (band stays a signal, not a sort).
  return rows.sort((a, b) => a.start.localeCompare(b.start));
}
