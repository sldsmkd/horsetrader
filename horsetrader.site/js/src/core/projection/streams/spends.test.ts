import { test } from "node:test";
import assert from "node:assert/strict";

import { spendStream, type CommittedBanner, type SpendGacha } from "./spends.ts";
import { cal } from "../dates.ts";
import type { ResourceVector } from "../ledger.ts";

const GACHA: SpendGacha = { caratsPerPull: 150, paidDailyPull: 50, sparkThreshold: 200 };
const AFTER = cal("2026-06-01");

/** A flat income balance, the same at every date — so the only thing that varies a
 *  banner's available is the spends resolved before it (what we're testing). */
const flatIncome =
  (v: ResourceVector) =>
  (_date: string): ResourceVector => ({ ...v });

const banner = (over: Partial<CommittedBanner>): CommittedBanner => ({
  key: "banner",
  kind: "support",
  start: cal("2026-07-01"),
  end: cal("2026-07-13"), // 12-day run
  freePulls: 0,
  pity: 1,
  ...over,
});

test("a committed banner emits a negative debit at its start (the claim) and exposes its available", () => {
  const a = banner({ key: "a", pity: 1 }); // 200 pulls, 300 tickets cover them
  const { emissions, available } = spendStream([a], flatIncome({ free_carats: 100000, support_tickets: 300 }), GACHA, AFTER);

  assert.equal(emissions.length, 1);
  assert.equal(emissions[0].date, "2026-07-01"); // debits at start, not end (2026-07-13)
  assert.equal(emissions[0].source, "a");
  assert.equal(emissions[0].deltas.support_tickets, -200); // 200 pulls off tickets
  assert.equal(available.get("a")?.support_tickets, 300); // its own spend NOT subtracted
});

test("self-exclusion: a banner's available never nets out its own spend", () => {
  const a = banner({ key: "a", pity: 1 });
  const { available } = spendStream([a], flatIncome({ free_carats: 50000, support_tickets: 500 }), GACHA, AFTER);
  // 500 tickets in, the banner spends 200 — available still reads the full 500.
  assert.equal(available.get("a")?.support_tickets, 500);
});

test("ticket-stealing: a later banner attributes against what the earlier one left", () => {
  // Both support, 1 pity (200 pulls). Income 300 tickets, lots of free carats.
  const a = banner({ key: "a", start: cal("2026-07-01"), end: cal("2026-07-13"), pity: 1 });
  const b = banner({ key: "b", start: cal("2026-08-01"), end: cal("2026-08-13"), pity: 1 });
  const { emissions, available } = spendStream([b, a], flatIncome({ free_carats: 100000, support_tickets: 300 }), GACHA, AFTER);

  // Resolved a (earlier start) then b. a takes 200 tickets; b sees only 100 left and falls
  // back to free carats for the other 100 pulls (100 × 150 = 15,000).
  assert.equal(available.get("a")?.support_tickets, 300);
  assert.equal(available.get("b")?.support_tickets, 100);
  const bEmit = emissions.find((e) => e.source === "b")!;
  assert.equal(bEmit.deltas.support_tickets, -100);
  assert.equal(bEmit.deltas.free_carats, -15000);
});

test("same start date resolves by banner id (deterministic tie-break)", () => {
  // Two banners opening the same day; "a" < "z", so a resolves first and drains tickets.
  const z = banner({ key: "z", start: cal("2026-07-01"), pity: 1 });
  const a = banner({ key: "a", start: cal("2026-07-01"), pity: 1 });
  const { available } = spendStream([z, a], flatIncome({ support_tickets: 300, free_carats: 100000 }), GACHA, AFTER);
  assert.equal(available.get("a")?.support_tickets, 300); // first
  assert.equal(available.get("z")?.support_tickets, 100); // sees a's 200 already gone
});

test("only committed banners whose claim is still future are resolved", () => {
  // `past` already opened (start before AFTER) — its real spend is in the snapshot.
  const past = banner({ key: "past", start: cal("2026-04-01"), end: cal("2026-05-01"), pity: 5 });
  const zero = banner({ key: "zero", start: cal("2026-09-01"), pity: 0 }); // not committed
  const live = banner({ key: "live", start: cal("2026-09-01"), end: cal("2026-09-13"), pity: 1 });
  const { emissions, available } = spendStream([past, zero, live], flatIncome({ support_tickets: 500 }), GACHA, AFTER);
  assert.deepEqual(
    emissions.map((e) => e.source),
    ["live"],
  );
  assert.equal(available.has("past"), false);
  assert.equal(available.has("zero"), false);
});

test("trainee banners debit trainee tickets, not support", () => {
  const t = banner({ key: "t", kind: "trainee", pity: 1 });
  const { emissions } = spendStream([t], flatIncome({ trainee_tickets: 300, support_tickets: 300 }), GACHA, AFTER);
  assert.equal(emissions[0].deltas.trainee_tickets, -200);
  assert.equal(emissions[0].deltas.support_tickets, undefined); // support pool untouched
});
