import { test } from "node:test";
import assert from "node:assert/strict";

import { clubRankStream, clubRankSpecFromBundle } from "./clubrank.ts";
import type { ClubRankSpec } from "./clubrank.ts";
import { cal } from "../dates.ts";
import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle, AnchorRecord } from "../../bundle/events.gen.ts";

function spec(over: Partial<ClubRankSpec> = {}): ClubRankSpec {
  return {
    epoch: cal("2026-01-01"),
    horizon: cal("2026-06-30"),
    monthly: { free_carats: 1800 },
    ...over,
  };
}

test("pays the flat monthly row on the 1st of every month in span (after the snapshot)", () => {
  const out = clubRankStream(spec(), cal("2025-12-01"));
  assert.deepEqual(
    out.map((e) => [e.date, e.source, e.deltas["free_carats"]]),
    [
      ["2026-01-01", "club-rank", 1800],
      ["2026-02-01", "club-rank", 1800],
      ["2026-03-01", "club-rank", 1800],
      ["2026-04-01", "club-rank", 1800],
      ["2026-05-01", "club-rank", 1800],
      ["2026-06-01", "club-rank", 1800],
    ],
  );
});

test("only month-starts strictly after `after` emit; earlier ones are baked into the snapshot", () => {
  const out = clubRankStream(spec(), cal("2026-03-15"));
  assert.deepEqual(out.map((e) => e.date), ["2026-04-01", "2026-05-01", "2026-06-01"]);
});

test("a snapshot exactly on a 1st does not re-pay that month (strictly-after)", () => {
  const out = clubRankStream(spec(), cal("2026-04-01"));
  assert.deepEqual(out.map((e) => e.date), ["2026-05-01", "2026-06-01"]);
});

test("a mid-month epoch snaps the first payout to the next 1st", () => {
  // epoch 2026-01-15 → first 1st on or after is 2026-02-01.
  const out = clubRankStream(spec({ epoch: cal("2026-01-15") }), cal("2025-12-01"));
  assert.deepEqual(out.map((e) => e.date), ["2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"]);
});

test("an epoch already on a 1st pays that month", () => {
  const out = clubRankStream(spec({ epoch: cal("2026-03-01"), horizon: cal("2026-04-30") }), cal("2025-01-01"));
  assert.deepEqual(out.map((e) => e.date), ["2026-03-01", "2026-04-01"]);
});

test("the cadence rolls across a year boundary", () => {
  const out = clubRankStream(spec({ epoch: cal("2026-11-10"), horizon: cal("2027-02-28") }), cal("2026-01-01"));
  assert.deepEqual(out.map((e) => e.date), ["2026-12-01", "2027-01-01", "2027-02-01"]);
});

test("a degenerate span (inverted) emits nothing", () => {
  assert.deepEqual(clubRankStream(spec({ epoch: cal("2026-12-31"), horizon: cal("2026-01-01") }), cal("2025-01-01")), []);
});

function config(over: Partial<ConfigBundle["reward_maps"]["club-rank"]> = {}): ConfigBundle {
  return {
    reward_structures: {},
    reward_maps: {
      "club-rank": {
        SS: { free_carats: 4500 },
        "B+": { free_carats: 1800 },
        "D+": { free_carats: 225 },
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

test("clubRankSpecFromBundle draws epoch/horizon from the bundle span and the row from the rank", () => {
  const b = bundle([
    anchor("late", "2026-03-01", "2026-03-10"),
    anchor("early", "2026-01-15", "2026-01-20"),
    anchor("end", "2026-06-01", "2026-06-30"),
  ]);
  assert.deepEqual(clubRankSpecFromBundle(b, config(), "B+"), {
    epoch: "2026-01-15",
    horizon: "2026-06-30",
    monthly: { free_carats: 1800 },
  });
});

test("clubRankSpecFromBundle buckets the bundle instants into the view timezone", () => {
  const b = bundle([anchor("x", "2026-01-15T22:00:00+00:00", "2026-06-30T22:00:00+00:00")]);
  const out = clubRankSpecFromBundle(b, config(), "B+", "Australia/Sydney");
  assert.equal(out?.epoch, "2026-01-16");
  assert.equal(out?.horizon, "2026-07-01");
});

test("clubRankSpecFromBundle returns null when it cannot run (no events, unknown rank, missing map)", () => {
  assert.equal(clubRankSpecFromBundle(bundle([]), config(), "B+"), null);
  assert.equal(clubRankSpecFromBundle(bundle([anchor("x", "2026-01-01", "2026-01-02")]), config(), "Z+"), null);
  const noMap: ConfigBundle = { reward_structures: {}, reward_maps: {}, gacha: config().gacha };
  assert.equal(clubRankSpecFromBundle(bundle([anchor("x", "2026-01-01", "2026-06-30")]), noMap, "B+"), null);
});
