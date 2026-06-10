/**
 * The spends stream — the one *dependent* projection stream. Every other stream is an
 * independent fixed-delta producer; a banner's spend is not, because its debit is
 * computed against the **balance at its `ev.end`**, which already reflects every earlier
 * banner's spend (shared pools — tickets, free carats — drained ahead of it). So it is
 * resolved by a single ordered pass: walk the committed banners in **(end-date,
 * banner-id)** order, threading the running spend, and at each one attribute the cost
 * against what's left (project_spend_model). If an earlier banner stole the tickets, a
 * later one simply re-attributes — the order is the whole mechanism.
 *
 * It is layered *after* the income fold: it takes the income-only `balanceAt` and emits
 * negative deltas at each `ev.end`, which the final fold flattens alongside the income
 * streams. It also returns the **per-banner available** (the balance *before* each
 * banner's own spend) — the card and shield read that, not the flattened series, so a
 * banner never sees its own debit fold back into its own availability (self-exclusion).
 */

import type { ResourceVector, StreamEmission } from "../ledger.ts";
import { spend, bannerDays } from "../pulls.ts";

export type BannerKind = "trainee" | "support";

/** A committed banner the pass resolves — identity, run, free-pull grant and pity. */
export interface CommittedBanner {
  key: string;
  kind: BannerKind;
  start: string;
  end: string;
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
  /** Negative-delta emissions at each banner's `ev.end`, for the final flatten. */
  emissions: StreamEmission[];
  /** Per committed banner: the balance available BEFORE its own spend (income minus the
   *  spends of every banner that resolves earlier) — what the card/shield show for it. */
  available: Map<string, ResourceVector>;
}

const ticketKeyOf = (kind: BannerKind): "support_tickets" | "trainee_tickets" =>
  kind === "support" ? "support_tickets" : "trainee_tickets";

export function spendStream(
  banners: CommittedBanner[],
  incomeBalanceAt: (date: string) => ResourceVector,
  gacha: SpendGacha,
  after: string,
): SpendStreamResult {
  // Only committed, still-future banners (a past banner's spend has already happened).
  // Resolve in (end-date, banner-id) order so each attributes against what's left.
  const ordered = banners
    .filter((b) => b.pity > 0 && b.end > after)
    .sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const emissions: StreamEmission[] = [];
  const available = new Map<string, ResourceVector>();
  const spent: ResourceVector = {}; // cumulative debit so far (positive amounts)

  for (const b of ordered) {
    const ticketKey = ticketKeyOf(b.kind);
    // Available = income at this banner's end, minus every *earlier* spend (not its own).
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
    emissions.push({ date: b.end, source: b.key, deltas });
    spent.free_carats = (spent.free_carats ?? 0) + debit.freeCarats;
    spent.paid_carats = (spent.paid_carats ?? 0) + debit.paidCarats;
    spent[ticketKey] = (spent[ticketKey] ?? 0) + debit.tickets;
  }

  return { emissions, available };
}
