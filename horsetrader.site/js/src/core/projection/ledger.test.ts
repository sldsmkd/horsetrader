import { test } from "node:test";
import assert from "node:assert/strict";

import { attribute, subtotals, balanceSeries } from "./ledger.ts";
import type { StreamEmission } from "./ledger.ts";

function emit(date: string, source: string, deltas: Record<string, number>): StreamEmission {
  return { date, source, deltas };
}

test("attribute flattens emissions into single-resource entries tagged with stream + source", () => {
  const ledger = attribute("events", [emit("2026-06-10", "banner-1", { carats_free: 720, trainee_tickets: 2 })]);
  assert.deepEqual(ledger, [
    { date: "2026-06-10", stream: "events", source: "banner-1", resource: "carats_free", amount: 720 },
    { date: "2026-06-10", stream: "events", source: "banner-1", resource: "trainee_tickets", amount: 2 },
  ]);
});

test("subtotals sum entries per resource per date, sparse over dates with entries", () => {
  const ledger = [
    ...attribute("a", [emit("2026-06-10", "x", { carats_free: 100 })]),
    ...attribute("b", [emit("2026-06-10", "y", { carats_free: 50, trainee_tickets: 1 })]),
    ...attribute("a", [emit("2026-06-12", "z", { carats_free: 30 })]),
  ];
  const byDate = subtotals(ledger);
  assert.deepEqual([...byDate.keys()].sort(), ["2026-06-10", "2026-06-12"]);
  assert.deepEqual(byDate.get("2026-06-10"), { carats_free: 150, trainee_tickets: 1 });
  assert.deepEqual(byDate.get("2026-06-12"), { carats_free: 30 });
});

test("balanceSeries exposes the change-points and the dense extent", () => {
  const base = { carats_free: 1000 };
  const ledger = [
    ...attribute("events", [emit("2026-06-10", "x", { carats_free: 100 })]),
    ...attribute("events", [emit("2026-06-12", "y", { carats_free: 50 })]),
  ];
  const series = balanceSeries(base, ledger);
  assert.deepEqual(series.dates, ["2026-06-10", "2026-06-12"]);
  assert.deepEqual(series.extent, ["2026-06-10", "2026-06-12"]);
});

test("the balance is materialised densely — every day in the extent is filled, even with no entry", () => {
  const series = balanceSeries({ carats_free: 1000 }, [
    ...attribute("events", [emit("2026-06-10", "x", { carats_free: 100 })]),
    ...attribute("events", [emit("2026-06-12", "y", { carats_free: 50 })]),
  ]);
  // 2026-06-11 has no entry but still resolves to the carried-forward balance.
  assert.deepEqual(series.balanceAt("2026-06-11"), { carats_free: 1100 });
});

test("an empty ledger has no change-points, a null extent, and always returns the base", () => {
  const series = balanceSeries({ carats_free: 1000 }, []);
  assert.deepEqual(series.dates, []);
  assert.equal(series.extent, null);
  assert.deepEqual(series.balanceAt("2026-06-11"), { carats_free: 1000 });
});

test("balanceAt holds flat between change-points and returns the base before the first", () => {
  const series = balanceSeries({ carats_free: 1000 }, [
    ...attribute("events", [emit("2026-06-10", "x", { carats_free: 100 })]),
    ...attribute("events", [emit("2026-06-12", "y", { carats_free: 50 })]),
  ]);
  assert.deepEqual(series.balanceAt("2026-06-01"), { carats_free: 1000 }); // before first
  assert.deepEqual(series.balanceAt("2026-06-10"), { carats_free: 1100 }); // on a change-point
  assert.deepEqual(series.balanceAt("2026-06-11"), { carats_free: 1100 }); // flat between
  assert.deepEqual(series.balanceAt("2026-06-12"), { carats_free: 1150 }); // next change-point
  assert.deepEqual(series.balanceAt("2026-07-01"), { carats_free: 1150 }); // after last
});

test("balances are allowed to go negative — no clamp at zero", () => {
  const series = balanceSeries({ carats_free: 30 }, attribute("spends", [emit("2026-06-10", "banner-1", { carats_free: -150 })]));
  assert.deepEqual(series.balanceAt("2026-06-10"), { carats_free: -120 });
});

test("balanceAt returns a copy — mutating it does not corrupt the cache", () => {
  const series = balanceSeries({ carats_free: 1000 }, attribute("events", [emit("2026-06-10", "x", { carats_free: 100 })]));
  const balance = series.balanceAt("2026-06-10");
  balance.carats_free = 0;
  assert.deepEqual(series.balanceAt("2026-06-10"), { carats_free: 1100 });
});
