import { test } from "node:test";
import assert from "node:assert/strict";

import { dailyPackStream, dailyPackSpecFromBundle, resolveDailyPack } from "./dailypack.ts";
import type { DailyPackSpec } from "./dailypack.ts";
import { cal } from "../dates.ts";
import type { EventsBundle, AnchorRecord } from "../../bundle/events.gen.ts";
import type { ConfigBundle } from "../../bundle/config.gen.ts";

function spec(over: Partial<DailyPackSpec> = {}): DailyPackSpec {
  return {
    epoch: cal("2026-01-01"),
    horizon: cal("2026-03-31"),
    anchor: cal("2026-02-10"),
    dailyFree: 50,
    cyclePaid: 500,
    cycleDays: 30,
    ...over,
  };
}

/** A config carrying just the baked `daily-carats` structure (50/day for 30 days + 500 paid). */
function config(over: Record<string, unknown> = {}): ConfigBundle {
  return {
    reward_structures: { "daily-carats": { paid_carats: 500, generator: { free_carats: 50, repeat: 30 } }, ...over },
    reward_maps: {},
    gacha: { spark_threshold: 200, carats_per_pull: 150, paid_daily_pull: 50, rarity_rates: {}, featured_rates: {} },
  };
}

test("pays 50 free carats every day after the snapshot, through the horizon", () => {
  const out = dailyPackStream(spec({ epoch: cal("2026-01-01"), horizon: cal("2026-01-05") }), cal("2026-01-02"));
  const free = out.filter((e) => "free_carats" in e.deltas);
  assert.deepEqual(
    free.map((e) => [e.date, e.deltas["free_carats"]]),
    [
      ["2026-01-03", 50],
      ["2026-01-04", 50],
      ["2026-01-05", 50],
    ],
  );
  assert.ok(free.every((e) => e.source === "daily-carats"));
});

test("the daily drip starts at the epoch when the snapshot precedes it", () => {
  const out = dailyPackStream(spec({ epoch: cal("2026-02-01"), horizon: cal("2026-02-03") }), cal("2026-01-15"));
  const free = out.filter((e) => "free_carats" in e.deltas);
  assert.deepEqual(free.map((e) => e.date), ["2026-02-01", "2026-02-02", "2026-02-03"]);
});

test("pays 500 paid carats every 30 days, phased off the anchor (a cycle boundary)", () => {
  // anchor 2026-02-10 ⇒ boundaries …01-11, 02-10, 03-12… within [01-01, 03-31].
  const out = dailyPackStream(spec(), cal("2025-12-31"));
  const paid = out.filter((e) => "paid_carats" in e.deltas);
  assert.deepEqual(
    paid.map((e) => [e.date, e.deltas["paid_carats"]]),
    [
      ["2026-01-11", 500],
      ["2026-02-10", 500],
      ["2026-03-12", 500],
    ],
  );
});

test("a paid boundary on the snapshot day is already baked in (strictly-after)", () => {
  const out = dailyPackStream(spec(), cal("2026-01-11"));
  const paid = out.filter((e) => "paid_carats" in e.deltas).map((e) => e.date);
  assert.deepEqual(paid, ["2026-02-10", "2026-03-12"]);
});

function bundle(events: AnchorRecord[]): EventsBundle {
  return { events };
}

function anchorRec(key: string, start: string, end: string): AnchorRecord {
  return { type: "anchor", start, end, predicted: false, key };
}

test("dailyPackSpecFromBundle reads the baked amounts, the span, and the validity date", () => {
  const b = bundle([anchorRec("x", "2026-01-15", "2026-06-30")]);
  assert.deepEqual(dailyPackSpecFromBundle(b, config(), cal("2026-02-10")), {
    epoch: "2026-01-15",
    horizon: "2026-06-30",
    anchor: "2026-02-10",
    dailyFree: 50,
    cyclePaid: 500,
    cycleDays: 30,
  });
});

test("dailyPackSpecFromBundle returns null when unsubscribed, empty, or the structure is missing", () => {
  const b = bundle([anchorRec("x", "2026-01-15", "2026-06-30")]);
  assert.equal(dailyPackSpecFromBundle(b, config(), null), null);
  assert.equal(dailyPackSpecFromBundle(bundle([]), config(), cal("2026-02-10")), null);
  const noStruct = { reward_structures: {}, reward_maps: {}, gacha: config().gacha } as ConfigBundle;
  assert.equal(dailyPackSpecFromBundle(b, noStruct, cal("2026-02-10")), null);
});

test("resolveDailyPack reads the validity date out of config, null when unset/malformed", () => {
  assert.equal(resolveDailyPack({ dailyPack: "2026-07-06" }), "2026-07-06");
  assert.equal(resolveDailyPack({ dailyPack: "  2026-07-06  " }), "2026-07-06");
  assert.equal(resolveDailyPack(undefined), null);
  assert.equal(resolveDailyPack({}), null);
  assert.equal(resolveDailyPack({ dailyPack: "" }), null);
  assert.equal(resolveDailyPack({ dailyPack: "next tuesday" }), null);
  assert.equal(resolveDailyPack({ dailyPack: 12345 }), null);
});
