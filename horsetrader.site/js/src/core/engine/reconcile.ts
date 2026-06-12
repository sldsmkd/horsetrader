/**
 * Reconciliation — coordinator machinery, the third pipeline stage:
 * `union → fold → P_income → reconcile(commitments) → P_final`. There is no
 * late STREAM (eclipse/2.DESIGN.md): streams produce events, full stop;
 * balance-readers are reconciliation rules.
 *
 * A commitment is account state the user raises AGAINST an event (a stable-key
 * reference: `commitments[key] = pity`); the referent never knows. The pass:
 * iterate the claims, dereference each referent in the settled world
 * (resolve-or-throw — the coordinator prunes stale keys at load, so a miss
 * here is a bug), use it only for its dates/kind/grant, emit the debit.
 * Loop over claims dereferencing events — never over events checking claims.
 *
 * Ordering: (start date, stable key) — deterministic, and it only affects
 * claim SENIORITY in availability (debits commute; P_final is
 * ordering-independent). Seniority binds at earmark: the debit folds at the
 * event's `start` (money put aside as the bill arrives), while availability is
 * measured at its `end` (max ammo — the window's income is all in). Overflow
 * lands on free carats, which may go negative — the planner's pressure
 * dimension, never an error.
 *
 * The debit `source` is the CLAIMED EVENT's stable key (`banner-kita` cost you
 * X — readable straight off the ledger). Income-vs-spend is positional: debits
 * exist only in P_final's reconciliation tail, never a vocabulary on the row.
 */

import type { CalendarDate } from "../projection/dates.ts";
import type { ResourceVector, StreamEmission } from "../projection/ledger.ts";
import { bannerDays, spend } from "../projection/pulls.ts";
import type { SettledEvent } from "./stream.ts";

/** The ledger stream tag of the reconciliation tail — positional provenance. */
export const RECONCILIATION_STREAM = "commitments";

/** Gacha pull-math constants the debit math reads (the baked `config.gacha`). */
export interface Gacha {
  caratsPerPull: number;
  paidDailyPull: number;
  sparkThreshold: number;
}

export interface ReconcileResult {
  /** The debit emissions, one per live claim, at each referent's `start`. */
  emissions: StreamEmission[];
  /** Per claimed key: the resources a claim against it sees — income at the
   *  referent's `end` minus every earlier-by-start claim, self-excluded. */
  available: Map<string, ResourceVector>;
}

const ticketKeyOf = (kind: string): "support_tickets" | "trainee_tickets" =>
  kind === "support" ? "support_tickets" : "trainee_tickets";

/**
 * The pure ordered pass. `byKey` is the settled world's key index; a claim
 * whose referent is missing throws (prune stale claims before deriving).
 * Claims on events already open (`start <= after`) are skipped — their real
 * spend is in the snapshot reading; re-debiting would double-count.
 */
export function reconcile(
  commitments: Record<string, number>,
  byKey: ReadonlyMap<string, SettledEvent>,
  incomeBalanceAt: (date: CalendarDate) => ResourceVector,
  gacha: Gacha,
  after: CalendarDate,
): ReconcileResult {
  const referents: { event: SettledEvent; pity: number }[] = [];
  for (const [key, pity] of Object.entries(commitments)) {
    if (!pity) continue; // unset or 0 — no claim
    const event = byKey.get(key);
    if (!event) throw new Error(`reconcile: commitment against unknown event "${key}"`);
    if (event.start <= after) continue; // already open — its spend is in the snapshot
    referents.push({ event, pity });
  }
  referents.sort((a, b) =>
    a.event.start < b.event.start ? -1 : a.event.start > b.event.start ? 1 : a.event.key < b.event.key ? -1 : a.event.key > b.event.key ? 1 : 0,
  );

  const emissions: StreamEmission[] = [];
  const available = new Map<string, ResourceVector>();
  const spent: ResourceVector = {}; // cumulative earmarks so far (positive amounts)

  for (const { event, pity } of referents) {
    const ticketKey = ticketKeyOf(event.type);
    // Available = income at this referent's end, minus every earlier-by-start claim (not its own).
    const avail: ResourceVector = { ...incomeBalanceAt(event.end) };
    for (const [k, amount] of Object.entries(spent)) avail[k] = (avail[k] ?? 0) - amount;
    available.set(event.key, avail);

    // The free-pull grant is banner-scoped, read off the record at the point of
    // spend — never banked (the face excludes it by construction).
    const freePulls = typeof event.record?.rewards?.["pulls"] === "number" ? (event.record.rewards["pulls"] as number) : 0;
    const debit = spend(
      { freePulls, tickets: avail[ticketKey] ?? 0, freeCarats: avail["free_carats"] ?? 0, paidCarats: avail["paid_carats"] ?? 0 },
      { caratsPerPull: gacha.caratsPerPull, paidDailyPull: gacha.paidDailyPull, bannerDays: bannerDays(event.start, event.end) },
      gacha.sparkThreshold,
      pity,
    );

    // Only the non-zero debits — a 0 would attribute a dead `…: 0` ledger entry.
    const deltas: ResourceVector = {};
    if (debit.freeCarats) deltas["free_carats"] = -debit.freeCarats;
    if (debit.paidCarats) deltas["paid_carats"] = -debit.paidCarats;
    if (debit.tickets) deltas[ticketKey] = -debit.tickets;
    emissions.push({ date: event.start, source: event.key, deltas });
    spent["free_carats"] = (spent["free_carats"] ?? 0) + debit.freeCarats;
    spent["paid_carats"] = (spent["paid_carats"] ?? 0) + debit.paidCarats;
    spent[ticketKey] = (spent[ticketKey] ?? 0) + debit.tickets;
  }

  return { emissions, available };
}
