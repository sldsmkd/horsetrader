import { test } from "node:test";
import assert from "node:assert/strict";

import { routineStream, routineSpecFromBundle } from "./routine.ts";
import type { RoutineSpec } from "./routine.ts";
import { cal } from "../dates.ts";
import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle, HolidayRecord } from "../../bundle/events.gen.ts";

const CYCLE = { resource: "free_carats", amounts: [25, null, 25, null, 25, null, 75] };

function spec(over: Partial<RoutineSpec> = {}): RoutineSpec {
  return {
    epoch: cal("2026-01-01"),
    horizon: cal("2026-12-31"),
    daysPerWeek: 7,
    daily: { free_carats: 75 },
    cycle: CYCLE,
    ...over,
  };
}

test("a 7-day player logs in every day: dailies land daily, the cycle steps one slot per day", () => {
  const out = routineStream(spec({ epoch: cal("2026-06-09"), horizon: cal("2026-06-15") }), cal("2026-06-01"));
  // 7 consecutive login days, each a +75 daily; the cycle [25,_,25,_,25,_,75] advances per login.
  const dailies = out.filter((e) => e.source === "dailies").map((e) => e.date);
  assert.deepEqual(dailies, [
    "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14", "2026-06-15",
  ]);
  const bonuses = out.filter((e) => e.source === "weekly-login");
  // nulls emit nothing — only the 4 paying slots land, summing to the full 150 over 7 logins.
  assert.deepEqual(bonuses.map((e) => [e.date, e.deltas["free_carats"]]), [
    ["2026-06-09", 25], ["2026-06-11", 25], ["2026-06-13", 25], ["2026-06-15", 75],
  ]);
});

test("a 2-day player logs in 2 of every 7 days, spread (offsets 0 and 3)", () => {
  const out = routineStream(spec({ epoch: cal("2026-06-09"), horizon: cal("2026-06-22"), daysPerWeek: 2 }), cal("2026-06-01"));
  const dailies = out.filter((e) => e.source === "dailies").map((e) => e.date);
  // block 0: 06-09 (+0), 06-12 (+3); block 1: 06-16 (+0), 06-19 (+3)
  assert.deepEqual(dailies, ["2026-06-09", "2026-06-12", "2026-06-16", "2026-06-19"]);
});

test("the login cycle advances by login count, not calendar day — it resets every 7 logins regardless of gaps", () => {
  // 2 logins/week: the cycle still walks 25,_,25,_,25,_,75 across the 7 logins, ignoring the day gaps.
  const out = routineStream(spec({ epoch: cal("2026-06-09"), horizon: cal("2026-09-01"), daysPerWeek: 2 }), cal("2026-06-01"));
  const bonuses = out.filter((e) => e.source === "weekly-login").map((e) => e.deltas["free_carats"]);
  // first 7 logins → the full cycle's paying slots, in order, then it wraps.
  assert.deepEqual(bonuses.slice(0, 4), [25, 25, 25, 75]);
});

test("only days strictly after `after` emit, but the cycle phase still advances across the snapshot", () => {
  // epoch 06-09; snapshot at 06-11. The first three logins (09,10,11) are baked, but their cycle
  // steps still count, so 06-12 lands on slot 3 (null → no bonus), 06-13 on slot 4 (25).
  const out = routineStream(spec({ epoch: cal("2026-06-09"), horizon: cal("2026-06-15") }), cal("2026-06-11"));
  assert.deepEqual(out.filter((e) => e.source === "dailies").map((e) => e.date), [
    "2026-06-12", "2026-06-13", "2026-06-14", "2026-06-15",
  ]);
  assert.deepEqual(out.filter((e) => e.source === "weekly-login").map((e) => [e.date, e.deltas["free_carats"]]), [
    ["2026-06-13", 25], ["2026-06-15", 75],
  ]);
});

test("a degenerate spec (no login days, empty cycle, or inverted span) emits nothing", () => {
  assert.deepEqual(routineStream(spec({ daysPerWeek: 0 }), cal("2025-01-01")), []);
  assert.deepEqual(routineStream(spec({ cycle: { resource: "free_carats", amounts: [] } }), cal("2025-01-01")), []);
  assert.deepEqual(routineStream(spec({ epoch: cal("2026-12-31"), horizon: cal("2026-01-01") }), cal("2025-01-01")), []);
});

function config(over: Partial<ConfigBundle["reward_structures"]> = {}): ConfigBundle {
  return {
    reward_structures: {
      dailies: { free_carats: 75 },
      "weekly-login": { sequence: { type: "free_carats", sequence: [25, null, 25, null, 25, null, 75] } },
      ...over,
    },
    reward_maps: {},
    gacha: { spark_threshold: 200, carats_per_pull: 150, paid_daily_pull: 50, rarity_rates: {}, featured_rates: {} },
  };
}

function bundle(events: HolidayRecord[]): EventsBundle {
  return { events };
}

function holiday(key: string, start: string, end: string): HolidayRecord {
  return { type: "holiday", name: key, start, end, predicted: false, key };
}

test("routineSpecFromBundle draws epoch/horizon from the bundle span and frequency from the play level", () => {
  const b = bundle([
    holiday("late", "2026-03-01", "2026-03-10"),
    holiday("early", "2026-01-15", "2026-01-20"),
    holiday("end", "2026-06-01", "2026-06-30"),
  ]);
  const out = routineSpecFromBundle(b, config(), "fourDays");
  assert.deepEqual(out, {
    epoch: "2026-01-15",
    horizon: "2026-06-30",
    daysPerWeek: 4,
    daily: { free_carats: 75 },
    cycle: { resource: "free_carats", amounts: [25, null, 25, null, 25, null, 75] },
  });
});

test("routineSpecFromBundle buckets the bundle instants into the view timezone", () => {
  const b = bundle([holiday("x", "2026-01-15T22:00:00+00:00", "2026-06-30T22:00:00+00:00")]);
  const out = routineSpecFromBundle(b, config(), "sevenDays", "Australia/Sydney");
  assert.equal(out?.epoch, "2026-01-16");
  assert.equal(out?.horizon, "2026-07-01");
});

test("routineSpecFromBundle returns null when it cannot run (no events, unknown level, missing structures)", () => {
  assert.equal(routineSpecFromBundle(bundle([]), config(), "sevenDays"), null);
  assert.equal(routineSpecFromBundle(bundle([holiday("x", "2026-01-01", "2026-01-02")]), config(), "weekendsOnly"), null);
  assert.equal(
    routineSpecFromBundle(bundle([holiday("x", "2026-01-01", "2026-01-02")]), config({ dailies: {} }), "sevenDays"),
    null,
  );
});
