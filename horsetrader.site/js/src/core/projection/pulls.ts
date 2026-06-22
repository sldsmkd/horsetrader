/**
 * The banner pull-math: how a balance becomes *effective pulls on a banner*, and how a
 * committed pity *spends* that balance, under the efficiency spend model
 * (project_spend_model). It lives in `core` because the projection's spend stream owns
 * it now (the `ui` card readout and commit shield import it from here too, so all three
 * agree on the rules).
 *
 * The rules (all measured at `ev.end` — see the callers):
 *   - **Free pulls** (this banner's grant) are free and banner-local — count them first.
 *   - **Tickets** (kind-appropriate) are owned, one pull each.
 *   - **Daily paid pulls** are the discount engine: 50 paid carats vs the normal 150, but
 *     one per day, so the **banner duration caps** them — `min(days, ⌊paid / 50⌋)`. Paid
 *     carats are *only* ever spent this way; any the cap can't absorb bank forward (they
 *     are deliberately NOT counted as available pulls here).
 *   - **Free carats** are the full-price floor: `⌊free / 150⌋` pulls at 150 each.
 */

import type { ResourceVector } from "./ledger.ts";

/** A banner's spendable sources at its measurement instant — tickets already narrowed
 *  to the banner's kind, carats split into the free (full-price) and paid (daily-only)
 *  pools. */
export interface PullSources {
  /** This banner's own free-pull grant (banner-local; never banked). */
  freePulls: number;
  /** Kind-appropriate scout tickets (support tickets on a support banner, etc.). */
  tickets: number;
  /** Free carats — the full-price pool (`carats_per_pull`). */
  freeCarats: number;
  /** Paid carats — spendable only through the daily window (`paid_daily_pull`). */
  paidCarats: number;
}

/** The gacha + banner constants the math reads against. */
export interface PullCaps {
  /** Carats for one full-price pull (`gacha.carats_per_pull`, 150). */
  caratsPerPull: number;
  /** Paid carats for one daily discount pull (`gacha.paid_daily_pull`, 50). */
  paidDailyPull: number;
  /** Banner duration in days — the one-per-day cap on daily paid pulls. */
  bannerDays: number;
}

/** Pulls available, broken out by source (so a readout can show the mix and a
 *  reservation can consume them cheapest-first). `total` is their sum. */
export interface PullCapacity {
  freePulls: number;
  tickets: number;
  dailyPaid: number;
  freeCaratPulls: number;
  total: number;
}

export function pullCapacity(s: PullSources, c: PullCaps): PullCapacity {
  const freePulls = Math.max(0, s.freePulls);
  const tickets = Math.max(0, s.tickets);
  // Daily paid pulls: one per day, each 50 paid carats — whichever runs out first.
  const dailyPaid = Math.max(0, Math.min(c.bannerDays, Math.floor(s.paidCarats / c.paidDailyPull)));
  const freeCaratPulls = Math.max(0, Math.floor(s.freeCarats / c.caratsPerPull));
  return {
    freePulls,
    tickets,
    dailyPaid,
    freeCaratPulls,
    total: freePulls + tickets + dailyPaid + freeCaratPulls,
  };
}

/** The resources a committed pity *consumes* (positive amounts), cheapest-first. The
 *  caller debits these from the balance — free carats can exceed what's available (the
 *  overcommit shortfall), so the resulting balance may go negative; tickets and paid
 *  carats never over-spend (paid only ever leaves through the daily window). */
export interface SpendDebit {
  freeCarats: number;
  paidCarats: number;
  tickets: number;
}

/** Cover `pity × sparkThreshold` pulls cheapest-first (free pulls → tickets → daily paid
 *  → free carats) and return what each pool gave up. The single source of truth for both
 *  the shield's "after" (balance − debit) and the projection's spend emission (−debit).
 *
 *  `usePaid` opts into spending owned paid carats at FULL price (150, like free — not the
 *  50 discount) once the cheap sources run out (issue #65). With it on, the tail is:
 *  burn free carats down to the `< 150` remainder, then burn paid carats at full price
 *  toward the target, then surge any still-unmet need negative on free carats. With it
 *  off, paid only ever leaves through the daily window and free carats absorb the whole
 *  remainder (going negative — the release valve). */
export function spend(s: PullSources, c: PullCaps, sparkThreshold: number, pity: number, usePaid: boolean): SpendDebit {
  const cap = pullCapacity(s, c);
  let need = Math.max(0, pity) * sparkThreshold;
  need -= Math.min(cap.freePulls, need); // free pulls evaporate into the need (banner-local)
  const ticketsUsed = Math.min(cap.tickets, need);
  need -= ticketsUsed;
  const dailyUsed = Math.min(cap.dailyPaid, need);
  need -= dailyUsed;

  if (!usePaid) {
    return {
      // Whatever's left is full-price free carats — can exceed the pool (overcommit short).
      freeCarats: need * c.caratsPerPull,
      // Paid carats only leave through the daily window; the rest banks forward.
      paidCarats: dailyUsed * c.paidDailyPull,
      tickets: ticketsUsed,
    };
  }

  // Free carats first, floored at the un-spendable remainder (no full pull from `< 150`).
  const freeCaratPulls = Math.min(cap.freeCaratPulls, need);
  need -= freeCaratPulls;
  // Paid carats left after the daily window, spent at full price toward the target.
  const paidLeft = Math.max(0, s.paidCarats - dailyUsed * c.paidDailyPull);
  const paidFullPulls = Math.min(Math.floor(paidLeft / c.caratsPerPull), need);
  need -= paidFullPulls;
  return {
    // The floored free spend plus the surge for whatever paid couldn't cover — the surge
    // takes free carats negative (the pressure dimension stays on free).
    freeCarats: (freeCaratPulls + need) * c.caratsPerPull,
    // Daily-window paid (50 each) plus the full-price paid pulls (150 each).
    paidCarats: dailyUsed * c.paidDailyPull + paidFullPulls * c.caratsPerPull,
    tickets: ticketsUsed,
  };
}

/** What remains available on the banner after a pity commitment reserves its
 *  cheapest-first spend. This is the read model for surfaces that want "free
 *  after plan" rather than "available before plan"; projection still emits only
 *  banked resource debits, while UI can also show banner-local free pulls. */
export function remainingAfterSpend(s: PullSources, c: PullCaps, sparkThreshold: number, pity: number, usePaid: boolean): PullSources {
  const pullsNeeded = Math.max(0, pity) * sparkThreshold;
  const debit = spend(s, c, sparkThreshold, pity, usePaid);
  return {
    freePulls: Math.max(0, s.freePulls - pullsNeeded),
    tickets: s.tickets - debit.tickets,
    freeCarats: s.freeCarats - debit.freeCarats,
    paidCarats: s.paidCarats - debit.paidCarats,
  };
}

/** Pull capacity left on the same banner after reserving a pity commitment.
 *  This is the card-gutter read: the commitment consumes its own gift pulls and
 *  account sources, then `pullCapacity` floors each remaining source at zero. */
export function remainingCapacityAfterSpend(s: PullSources, c: PullCaps, sparkThreshold: number, pity: number, usePaid: boolean): PullCapacity {
  return pullCapacity(remainingAfterSpend(s, c, sparkThreshold, pity, usePaid), c);
}

/** A committed banner's funding state — the one derivation every surface reads off
 *  instead of re-running the pull-math: its pity, whether it can be funded from the
 *  projected balance (`unfundable` → the red band), and the pull capacity left after
 *  the commitment reserves its spend. The coordinator computes this once per write and
 *  caches it (see `commitmentStatuses`); the strip, plan drawer and timeline badge all
 *  read it, so they cannot disagree. `pity`/`unfundable` feed the shared `pityBand`. */
export interface CommitmentStatus {
  kind: "trainee" | "support";
  pity: number;
  unfundable: boolean;
  capacity: PullCapacity;
}

/** The gacha constants a commitment's funding reads against. */
export interface GachaRates {
  caratsPerPull: number;
  paidDailyPull: number;
  sparkThreshold: number;
}

/** Derive a committed banner's funding state from the balance it measures against —
 *  the single home for "commitment → fundability + capacity", assembling the
 *  kind-narrowed pull sources and running the spend once for both outputs. */
export function commitmentStatus(
  kind: "trainee" | "support",
  freePulls: number,
  start: string,
  end: string,
  balance: ResourceVector,
  gacha: GachaRates,
  pity: number,
  usePaid: boolean,
): CommitmentStatus {
  const caps: PullCaps = { caratsPerPull: gacha.caratsPerPull, paidDailyPull: gacha.paidDailyPull, bannerDays: bannerDays(start, end) };
  const sources: PullSources = {
    freePulls,
    tickets: (kind === "support" ? balance.support_tickets : balance.trainee_tickets) ?? 0,
    freeCarats: balance.free_carats ?? 0,
    paidCarats: balance.paid_carats ?? 0,
  };
  const remaining = remainingAfterSpend(sources, caps, gacha.sparkThreshold, pity, usePaid);
  return { kind, pity, unfundable: remaining.freeCarats < 0, capacity: pullCapacity(remaining, caps) };
}

/** Banner duration in whole days (`end − start`), the daily-pull cap. At least 1 — a
 *  same-day banner still gives one daily window. Format-agnostic (date or full instant). */
export function bannerDays(start: string, end: string): number {
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000));
}
