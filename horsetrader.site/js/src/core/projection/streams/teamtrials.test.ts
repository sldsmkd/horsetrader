import { test } from "node:test";
import assert from "node:assert/strict";

import { teamTrialsStream, teamTrialsSpecFromBundle } from "./teamtrials.ts";
import type { TeamTrialsSpec } from "./teamtrials.ts";
import { cal } from "../dates.ts";
import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle, AnchorRecord } from "../../bundle/events.gen.ts";

// 2026-06-01 is a Monday; the Mondays that follow are 06-08, 06-15, 06-22, 06-29.
function spec(over: Partial<TeamTrialsSpec> = {}): TeamTrialsSpec {
  return {
    epoch: cal("2026-06-01"),
    horizon: cal("2026-06-30"),
    cycle: [{ free_carats: 375 }],
    ...over,
  };
}

test("a stable class pays its single weekly row on every Monday in span (after the snapshot)", () => {
  const out = teamTrialsStream(spec(), cal("2026-01-01"));
  assert.deepEqual(
    out.map((e) => [e.date, e.source, e.deltas["free_carats"]]),
    [
      ["2026-06-01", "team-trials", 375],
      ["2026-06-08", "team-trials", 375],
      ["2026-06-15", "team-trials", 375],
      ["2026-06-22", "team-trials", 375],
      ["2026-06-29", "team-trials", 375],
    ],
  );
});

test("a flapping account alternates the two-week cycle (promote-to-6 = 300, demote-to-5 = 225) per Monday", () => {
  const out = teamTrialsStream(spec({ cycle: [{ free_carats: 300 }, { free_carats: 225 }] }), cal("2026-01-01"));
  assert.deepEqual(out.map((e) => [e.date, e.deltas["free_carats"]]), [
    ["2026-06-01", 300],
    ["2026-06-08", 225],
    ["2026-06-15", 300],
    ["2026-06-22", 225],
    ["2026-06-29", 300],
  ]);
});

test("only Mondays strictly after `after` emit, but the flapping phase still advances across the snapshot", () => {
  // epoch 06-01; snapshot at 06-10. Weeks 0 (06-01) and 1 (06-08) are baked, but the
  // cycle index still counts, so 06-15 lands on week 2 (300, promote) — not back at the start.
  const out = teamTrialsStream(spec({ cycle: [{ free_carats: 300 }, { free_carats: 225 }] }), cal("2026-06-10"));
  assert.deepEqual(out.map((e) => [e.date, e.deltas["free_carats"]]), [
    ["2026-06-15", 300],
    ["2026-06-22", 225],
    ["2026-06-29", 300],
  ]);
});

test("a non-Monday epoch snaps the cadence to the first Monday on or after it", () => {
  // epoch 06-09 (a Tuesday) → first payout is 06-15, the next Monday.
  const out = teamTrialsStream(spec({ epoch: cal("2026-06-09") }), cal("2026-01-01"));
  assert.deepEqual(out.map((e) => e.date), ["2026-06-15", "2026-06-22", "2026-06-29"]);
});

test("a degenerate spec (empty cycle or inverted span) emits nothing", () => {
  assert.deepEqual(teamTrialsStream(spec({ cycle: [] }), cal("2025-01-01")), []);
  assert.deepEqual(teamTrialsStream(spec({ epoch: cal("2026-12-31"), horizon: cal("2026-01-01") }), cal("2025-01-01")), []);
});

function config(over: Partial<ConfigBundle["reward_maps"]["team-trials"]> = {}): ConfigBundle {
  return {
    reward_structures: {},
    reward_maps: {
      "team-trials": {
        "6:promotion": { free_carats: 300 },
        "6:retention": { free_carats: 375 },
        "5:demotion": { free_carats: 225 },
        "5:retention": { free_carats: 225 },
        "4:retention": { free_carats: 150 },
        ...over,
      },
    },
    gacha: { spark_threshold: 200, carats_per_pull: 150, paid_daily_pull: 50, rarity_rates: {}, featured_rates: {} },
  };
}

function bundle(events: AnchorRecord[]): EventsBundle {
  return { events };
}

function anchor(key: string, start: string, end: string): AnchorRecord {
  return { type: "anchor", start, end, predicted: false, key };
}

test("teamTrialsSpecFromBundle draws epoch/horizon from the bundle span and the cadence from the play level", () => {
  const b = bundle([
    anchor("late", "2026-03-01", "2026-03-10"),
    anchor("early", "2026-01-15", "2026-01-20"),
    anchor("end", "2026-06-01", "2026-06-30"),
  ]);
  assert.deepEqual(teamTrialsSpecFromBundle(b, config(), "rank6"), {
    epoch: "2026-01-15",
    horizon: "2026-06-30",
    cycle: [{ free_carats: 375 }],
  });
});

test("a flapping level resolves to the two-row promotion/demotion cycle", () => {
  const b = bundle([anchor("x", "2026-01-15", "2026-06-30")]);
  assert.deepEqual(teamTrialsSpecFromBundle(b, config(), "rank55")?.cycle, [
    { free_carats: 300 },
    { free_carats: 225 },
  ]);
});

test("teamTrialsSpecFromBundle buckets the bundle instants into the view timezone", () => {
  const b = bundle([anchor("x", "2026-01-15T22:00:00+00:00", "2026-06-30T22:00:00+00:00")]);
  const out = teamTrialsSpecFromBundle(b, config(), "rank4", "Australia/Sydney");
  assert.equal(out?.epoch, "2026-01-16");
  assert.equal(out?.horizon, "2026-07-01");
});

test("teamTrialsSpecFromBundle returns null when it cannot run (no events, unknown level, missing row)", () => {
  assert.equal(teamTrialsSpecFromBundle(bundle([]), config(), "rank6"), null);
  assert.equal(teamTrialsSpecFromBundle(bundle([anchor("x", "2026-01-01", "2026-01-02")]), config(), "rank99"), null);
  // rank55 needs 6:promotion; a map without it can't resolve the cadence.
  const b = bundle([anchor("x", "2026-01-01", "2026-06-30")]);
  const without6Promo = config();
  delete without6Promo.reward_maps["team-trials"]["6:promotion"];
  assert.equal(teamTrialsSpecFromBundle(b, without6Promo, "rank55"), null);
});
