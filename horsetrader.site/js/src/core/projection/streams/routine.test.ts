import { test } from "node:test";
import assert from "node:assert/strict";

import {
  dailiesSpecFromBundle,
  dailiesStream,
  weeklyLoginSpecFromBundle,
  weeklyLoginStream,
} from "./routine.ts";
import type { DailiesSpec, WeeklyLoginSpec } from "./routine.ts";
import { cal } from "../dates.ts";
import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle, HolidayRecord } from "../../bundle/events.gen.ts";

const CYCLE = { resource: "free_carats", amounts: [25, null, 25, null, 25, null, 75] };

function dailies(over: Partial<DailiesSpec> = {}): DailiesSpec {
  return {
    epoch: cal("2026-06-09"),
    horizon: cal("2026-06-15"),
    daily: { free_carats: 75 },
    ...over,
  };
}

function weeklyLogin(over: Partial<WeeklyLoginSpec> = {}): WeeklyLoginSpec {
  return {
    epoch: cal("2026-06-09"),
    horizon: cal("2026-06-15"),
    cycle: CYCLE,
    ...over,
  };
}

test("dailiesStream emits the baked daily payload every day when enabled", () => {
  const out = dailiesStream(dailies(), cal("2026-06-01"));
  assert.deepEqual(
    out.map((e) => [e.date, e.source, e.deltas["free_carats"]]),
    [
      ["2026-06-09", "dailies", 75],
      ["2026-06-10", "dailies", 75],
      ["2026-06-11", "dailies", 75],
      ["2026-06-12", "dailies", 75],
      ["2026-06-13", "dailies", 75],
      ["2026-06-14", "dailies", 75],
      ["2026-06-15", "dailies", 75],
    ],
  );
});

test("weeklyLoginStream advances the seven-login cycle once per day", () => {
  const out = weeklyLoginStream(weeklyLogin(), cal("2026-06-01"));
  assert.deepEqual(
    out.map((e) => [e.date, e.source, e.deltas["free_carats"]]),
    [
      ["2026-06-09", "weekly-login", 25],
      ["2026-06-11", "weekly-login", 25],
      ["2026-06-13", "weekly-login", 25],
      ["2026-06-15", "weekly-login", 75],
    ],
  );
});

test("snapshot filtering does not reset weekly-login cycle phase", () => {
  const out = weeklyLoginStream(weeklyLogin(), cal("2026-06-11"));
  assert.deepEqual(out.map((e) => [e.date, e.deltas["free_carats"]]), [
    ["2026-06-13", 25],
    ["2026-06-15", 75],
  ]);
});

test("degenerate specs emit nothing", () => {
  assert.deepEqual(dailiesStream(dailies({ daily: {} }), cal("2025-01-01")), []);
  assert.deepEqual(dailiesStream(dailies({ epoch: cal("2026-12-31"), horizon: cal("2026-01-01") }), cal("2025-01-01")), []);
  assert.deepEqual(weeklyLoginStream(weeklyLogin({ cycle: { resource: "free_carats", amounts: [] } }), cal("2025-01-01")), []);
  assert.deepEqual(weeklyLoginStream(weeklyLogin({ epoch: cal("2026-12-31"), horizon: cal("2026-01-01") }), cal("2025-01-01")), []);
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

test("dailiesSpecFromBundle draws epoch/horizon and daily payload from the bake", () => {
  const b = bundle([
    holiday("late", "2026-03-01", "2026-03-10"),
    holiday("early", "2026-01-15", "2026-01-20"),
    holiday("end", "2026-06-01", "2026-06-30"),
  ]);
  assert.deepEqual(dailiesSpecFromBundle(b, config()), {
    epoch: "2026-01-15",
    horizon: "2026-06-30",
    daily: { free_carats: 75 },
  });
});

test("weeklyLoginSpecFromBundle draws epoch/horizon and cycle from the bake", () => {
  const b = bundle([holiday("x", "2026-01-15", "2026-06-30")]);
  assert.deepEqual(weeklyLoginSpecFromBundle(b, config()), {
    epoch: "2026-01-15",
    horizon: "2026-06-30",
    cycle: CYCLE,
  });
});

test("routine specs bucket bundle instants into the view timezone", () => {
  const b = bundle([holiday("x", "2026-01-15T22:00:00+00:00", "2026-06-30T22:00:00+00:00")]);
  assert.equal(dailiesSpecFromBundle(b, config(), "Australia/Sydney")?.epoch, "2026-01-16");
  assert.equal(weeklyLoginSpecFromBundle(b, config(), "Australia/Sydney")?.horizon, "2026-07-01");
});

test("routine specs return null when required bake data is missing", () => {
  const b = bundle([holiday("x", "2026-01-01", "2026-01-02")]);
  assert.equal(dailiesSpecFromBundle(bundle([]), config()), null);
  assert.equal(weeklyLoginSpecFromBundle(bundle([]), config()), null);
  assert.equal(dailiesSpecFromBundle(b, config({ dailies: {} })), null);
  assert.equal(weeklyLoginSpecFromBundle(b, config({ "weekly-login": {} })), null);
});
