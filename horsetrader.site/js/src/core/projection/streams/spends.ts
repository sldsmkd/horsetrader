/**
 * The spends stream — the one *dependent* projection stream. Every other stream is an
 * independent fixed-delta producer; a banner's spend is not. A commitment is a **claim**
 * (an accounting earmark against resources), not a tracked transaction, and that reframe
 * splits its two timings (project_spend_model):
 *   - **measured** against the balance at its `ev.end` (max ammo — daily income, free
 *     pulls and tickets are all in by the banner's close), but
 *   - **debited at its `ev.start`** — once committed you start earmarking the moment the
 *     banner opens, so any later banner sees those resources already spoken for.
 * The availability still reflects every *earlier-by-start* banner's spend (shared pools —
 * tickets, free carats — drained ahead of it), so it is resolved by a single ordered
 * pass: walk the committed banners in **(start-date, banner-id)** order, threading the
 * running spend, and at each one attribute the cost against what's left. If an earlier
 * banner stole the tickets, a later one simply re-attributes — the order is the mechanism.
 *
 * Overcommit is fine (this is a planner, not a bank): the cost-ascending order routes all
 * overflow to **free carats**, the one pool that can go negative — a claim against income
 * that hasn't arrived yet. Tickets floor at 0 and paid carats bank rather than overdraw,
 * so negative free carats is the single pressure dimension by construction (see `spend`).
 *
 * It is layered *after* the income fold: it takes the income-only `balanceAt` and emits
 * negative deltas at each `ev.start`, which the final fold flattens alongside the income
 * streams. It also returns the **per-banner available** (the balance *before* each
 * banner's own spend) — the card and shield read that, not the flattened series, so a
 * banner never sees its own debit fold back into its own availability (self-exclusion).
 */

import type { ResourceVector, StreamEmission } from "../ledger.ts";
import type { CalendarDate } from "../dates.ts";
import { spend, bannerDays } from "../pulls.ts";

export type BannerKind = "trainee" | "support";

/** A committed banner the pass resolves — identity, run, free-pull grant and pity. */
export interface CommittedBanner {
  key: string;
  kind: BannerKind;
  start: CalendarDate;
  end: CalendarDate;
  freePulls: number;
  pity: number;
}

/** The gacha constants the debit math reads. */
export interface SpendGacha {
  caratsPerPull: number;
  paidDailyPull: number;
  sparkThreshold: number;
}

export interface SpendStreamResult {
  /** Negative-delta emissions at each banner's `ev.start` (the claim), for the final flatten. */
  emissions: StreamEmission[];
  /** Per committed banner: the balance available BEFORE its own spend (income minus the
   *  spends of every banner that resolves earlier) — what the card/shield show for it. */
  available: Map<string, ResourceVector>;
}

const ticketKeyOf = (kind: BannerKind): "support_tickets" | "trainee_tickets" =>
  kind === "support" ? "support_tickets" : "trainee_tickets";

export function spendStream(
  banners: CommittedBanner[],
  incomeBalanceAt: (date: CalendarDate) => ResourceVector,
  gacha: SpendGacha,
  after: CalendarDate,
): SpendStreamResult {
  // Only committed banners whose claim is still future — a banner that has already opened
  // (`start <= after`) has its real spend baked into the snapshot, so re-debiting it would
  // double-count. Resolve in (start-date, banner-id) order so each attributes against
  // what's left, because the debit now lands at the banner's start.
  const ordered = banners
    .filter((b) => b.pity > 0 && b.start > after)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const emissions: StreamEmission[] = [];
  const available = new Map<string, ResourceVector>();
  const spent: ResourceVector = {}; // cumulative debit so far (positive amounts)

  for (const b of ordered) {
    const ticketKey = ticketKeyOf(b.kind);
    // Available = income at this banner's end (measured at max ammo), minus every
    // earlier-by-start spend (not its own).
    const avail: ResourceVector = { ...incomeBalanceAt(b.end) };
    for (const [k, amount] of Object.entries(spent)) avail[k] = (avail[k] ?? 0) - amount;
    available.set(b.key, avail);

    const debit = spend(
      { freePulls: b.freePulls, tickets: avail[ticketKey] ?? 0, freeCarats: avail.free_carats ?? 0, paidCarats: avail.paid_carats ?? 0 },
      { caratsPerPull: gacha.caratsPerPull, paidDailyPull: gacha.paidDailyPull, bannerDays: bannerDays(b.start, b.end) },
      gacha.sparkThreshold,
      b.pity,
    );

    // Only the non-zero debits — a 0 would attribute a dead `…: 0` ledger entry.
    const deltas: ResourceVector = {};
    if (debit.freeCarats) deltas.free_carats = -debit.freeCarats;
    if (debit.paidCarats) deltas.paid_carats = -debit.paidCarats;
    if (debit.tickets) deltas[ticketKey] = -debit.tickets;
    // The claim debits at the banner's start — committing earmarks resources as it opens.
    emissions.push({ date: b.start, source: b.key, deltas });
    spent.free_carats = (spent.free_carats ?? 0) + debit.freeCarats;
    spent.paid_carats = (spent.paid_carats ?? 0) + debit.paidCarats;
    spent[ticketKey] = (spent[ticketKey] ?? 0) + debit.tickets;
  }

  return { emissions, available };
}
