/**
 * Planner bar selector: committed banners as compact navigation cards. This is
 * the Favourites bar's other face, derived from the same persisted plan document
 * but keyed by banner commitment rather than favourite atom.
 */

import type { Commitments } from "../../core/persistence/document.ts";
import type { ResourceVector } from "../../core/persistence/document.ts";
import { commitmentPity, commitmentUsePaid } from "../../core/persistence/document.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import { bannerDays, remainingAfterSpend } from "../../core/projection/pulls.ts";
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

export interface PlannerInputs {
  balanceAt: (date: CalendarDate) => ResourceVector;
  availableFor: (eventKey: string) => ResourceVector | undefined;
}

const NO_INPUTS: PlannerInputs = { balanceAt: () => ({}), availableFor: () => undefined };

export function plannerRows(bundle: Bundle, commitments: Commitments, now: CalendarDate, inputs: PlannerInputs = NO_INPUTS): PlannerRow[] {
  const rows: PlannerRow[] = [];
  const { carats_per_pull: caratsPerPull, paid_daily_pull: paidDailyPull, spark_threshold: sparkThreshold } = bundle.config().gacha;
  for (const ev of bundle.all()) {
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    if (ev.end < now) continue;
    const commitment = commitments[ev.key];
    const pity = commitment == null ? 0 : commitmentPity(commitment);
    if (pity <= 0) continue;
    const usePaid = commitment == null ? false : commitmentUsePaid(commitment);
    const balance = inputs.availableFor(ev.key) ?? inputs.balanceAt(ev.end);
    const freePulls = typeof ev.rewards?.pulls === "number" ? ev.rewards.pulls : 0;
    const remaining = remainingAfterSpend(
      {
        freePulls,
        tickets: (ev.type === "support" ? balance.support_tickets : balance.trainee_tickets) ?? 0,
        freeCarats: balance.free_carats ?? 0,
        paidCarats: balance.paid_carats ?? 0,
      },
      { caratsPerPull, paidDailyPull, bannerDays: bannerDays(ev.start, ev.end) },
      sparkThreshold,
      pity,
      usePaid,
    );
    rows.push({
      key: ev.key,
      kind: ev.type,
      image: ev.image,
      date: ev.start,
      end: ev.end,
      predicted: ev.predicted,
      atoms: ev.contents.map((id) => atomOf(bundle, ev.type, id)).filter((atom): atom is BannerAtom => atom !== null).sort(compareAtoms),
      pity,
      unfundable: remaining.freeCarats < 0,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}
