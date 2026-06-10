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
  // Daily paid pulls: one per day, each 50 paid carats — whichever runs out first.
  const dailyPaid = Math.min(c.bannerDays, Math.floor(s.paidCarats / c.paidDailyPull));
  const freeCaratPulls = Math.floor(s.freeCarats / c.caratsPerPull);
  return {
    freePulls: s.freePulls,
    tickets: s.tickets,
    dailyPaid,
    freeCaratPulls,
    total: s.freePulls + s.tickets + dailyPaid + freeCaratPulls,
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
 *  the shield's "after" (balance − debit) and the projection's spend emission (−debit). */
export function spend(s: PullSources, c: PullCaps, sparkThreshold: number, pity: number): SpendDebit {
  const cap = pullCapacity(s, c);
  let need = Math.max(0, pity) * sparkThreshold;
  need -= Math.min(cap.freePulls, need); // free pulls evaporate into the need (banner-local)
  const ticketsUsed = Math.min(cap.tickets, need);
  need -= ticketsUsed;
  const dailyUsed = Math.min(cap.dailyPaid, need);
  need -= dailyUsed;
  return {
    // Whatever's left is full-price free carats — can exceed the pool (overcommit short).
    freeCarats: need * c.caratsPerPull,
    // Paid carats only leave through the daily window; the rest banks forward.
    paidCarats: dailyUsed * c.paidDailyPull,
    tickets: ticketsUsed,
  };
}

/** Banner duration in whole days (`end − start`), the daily-pull cap. At least 1 — a
 *  same-day banner still gives one daily window. Format-agnostic (date or full instant). */
export function bannerDays(start: string, end: string): number {
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000));
}
