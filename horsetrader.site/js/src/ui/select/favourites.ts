/**
 * Shared favourite derivations for UI surfaces. Persistence stores the atom ids;
 * this selector answers where those atoms appear on future banner beats. It stays
 * in `ui/select`, not `core/`, because future-only navigation is a view concern.
 */

import type { Favourites } from "../../core/persistence/document.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import type { Bundle } from "../bundle/access.ts";
import type { BannerKind } from "./aboveLane.ts";

export interface FavouriteBannerAppearance {
  date: CalendarDate;
  eventKey: string;
  kind: BannerKind;
  predicted: boolean;
  atomIds: string[];
}

/** Open-or-future banner appearances containing at least one favourited atom. */
export function favouriteBannerAppearances(bundle: Bundle, favourites: Favourites, now: CalendarDate): FavouriteBannerAppearance[] {
  const appearances: FavouriteBannerAppearance[] = [];
  for (const ev of bundle.all()) {
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    if (ev.end < now) continue;
    const atomIds = ev.contents.filter((id) => id in favourites);
    if (atomIds.length === 0) continue;
    appearances.push({ date: ev.start, eventKey: ev.key, kind: ev.type, predicted: ev.predicted, atomIds });
  }
  return appearances;
}
