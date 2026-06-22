/**
 * Planner bar selector: committed banners as compact navigation cards. This is
 * the Favourites bar's other face, derived from the same persisted plan document
 * but keyed by banner commitment rather than favourite atom.
 *
 * The funding state (pity + unfundable) is no longer re-derived here: it reads the
 * coordinator's cached `commitmentStatuses` (the one home for the pull-math), so the
 * plan drawer, the favourite strip and the timeline badge cannot disagree.
 */

import type { CalendarDate } from "../../core/projection/dates.ts";
import type { CommitmentStatus } from "../../core/projection/pulls.ts";
import type { Bundle } from "../bundle/access.ts";
import { atomOf, type BannerAtom, type BannerKind } from "./aboveLane.ts";

export interface PlannerRow {
  key: string;
  kind: BannerKind;
  image: string;
  date: CalendarDate;
  end: CalendarDate;
  predicted: boolean;
  atoms: BannerAtom[];
  pity: number;
  unfundable: boolean;
}

const NAME_ORDER = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function compareAtoms(a: BannerAtom, b: BannerAtom): number {
  return a.rarityTier.localeCompare(b.rarityTier) || NAME_ORDER.compare(a.name, b.name);
}

export function plannerRows(bundle: Bundle, statuses: ReadonlyMap<string, CommitmentStatus>, now: CalendarDate): PlannerRow[] {
  const rows: PlannerRow[] = [];
  for (const ev of bundle.all()) {
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    if (ev.end < now) continue;
    const status = statuses.get(ev.key);
    if (!status) continue; // uncommitted (or pity 0) — not in the cached map
    rows.push({
      key: ev.key,
      kind: ev.type,
      image: ev.image,
      date: ev.start,
      end: ev.end,
      predicted: ev.predicted,
      atoms: ev.contents.map((id) => atomOf(bundle, ev.type, id)).filter((atom): atom is BannerAtom => atom !== null).sort(compareAtoms),
      pity: status.pity,
      unfundable: status.unfundable,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}
