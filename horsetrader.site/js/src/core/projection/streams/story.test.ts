import { test } from "node:test";
import assert from "node:assert/strict";

import { storyStream } from "./story.ts";
import { cal } from "../dates.ts";
import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle, StoryRecord } from "../../bundle/events.gen.ts";

// Two eras (the bake's `story-1m` / `story-1-5m`), differing only at `dedicated`.
const TIERS_1M = {
  sweetie: { free_carats: 690, gold_crystal_shards: 1, support_tickets: 1 },
  casual: { free_carats: 1240, gold_crystal_shards: 2, rainbow_crystal_shards: 1, support_tickets: 1, trainee_tickets: 1 },
  focused: { free_carats: 1990, gold_crystal_shards: 3, rainbow_crystal_shards: 2, support_tickets: 2, trainee_tickets: 1 },
  dedicated: { free_carats: 2490, gold_crystal_shards: 3, rainbow_crystal_shards: 3, support_tickets: 2, trainee_tickets: 2 },
};
const TIERS_1_5M = { ...TIERS_1M, dedicated: { ...TIERS_1M.dedicated, free_carats: 3240 } };

function config(maps: ConfigBundle["reward_maps"] = { "story-1m": TIERS_1M, "story-1-5m": TIERS_1_5M }): ConfigBundle {
  return {
    reward_structures: {},
    reward_maps: maps,
    gacha: { spark_threshold: 200, carats_per_pull: 150, paid_daily_pull: 50, rarity_rates: {}, featured_rates: {} },
  };
}

function story(key: string, era: string | null, start: string, end: string): StoryRecord {
  return { type: "story", title: null, contents: [], image: null, banner: null, art: null, era, start, end, predicted: true, key, rushable: true };
}

function bundle(events: EventsBundle["events"]): EventsBundle {
  return { events };
}

const SERIES = bundle([
  story("story-011", "1m", "2027-01-01T22:00:00+00:00", "2027-01-12T22:00:00+00:00"),
  story("story-034", "1-5m", "2027-02-01T22:00:00+00:00", "2027-02-12T22:00:00+00:00"),
  story("story-001", null, "2027-03-01T22:00:00+00:00", "2027-03-12T22:00:00+00:00"), // proto era
]);

test("each tier's storyEvents key selects its reward-map row, paid on end", () => {
  const out = storyStream(SERIES, config(), "story", cal("2026-01-01"));
  assert.deepEqual(
    out.map((e) => [e.date, e.source]),
    [
      ["2027-01-12", "story-011"],
      ["2027-02-12", "story-034"],
    ],
  );
  assert.deepEqual(out[0].deltas, TIERS_1M.sweetie);
});

test("the era is read off the record (1m vs 1-5m diverge only at dedicated)", () => {
  const out = storyStream(SERIES, config(), "achievement", cal("2026-01-01"));
  assert.equal(out.find((e) => e.source === "story-011")?.deltas["free_carats"], 2490); // 1m dedicated
  assert.equal(out.find((e) => e.source === "story-034")?.deltas["free_carats"], 3240); // 1-5m dedicated
});

test("both achievement archetypes fold onto the dedicated ceiling", () => {
  const a = storyStream(SERIES, config(), "achievement", cal("2026-01-01"));
  const b = storyStream(SERIES, config(), "earlyAchievement", cal("2026-01-01"));
  assert.deepEqual(a.map((e) => e.deltas), b.map((e) => e.deltas));
});

test("proto-era stories (null era) pay nothing", () => {
  const out = storyStream(SERIES, config(), "major", cal("2026-01-01"));
  assert.equal(out.find((e) => e.source === "story-001"), undefined);
});

test("inert without a config map for the era", () => {
  const out = storyStream(SERIES, config({ "story-1m": TIERS_1M }), "welfare", cal("2026-01-01"));
  assert.deepEqual(out.map((e) => e.source), ["story-011"]); // 1-5m absent → that story pays nothing
});

test("a rushed story brings its bundle forward to start", () => {
  const out = storyStream(SERIES, config(), "story", cal("2026-01-01"), undefined, new Set(["story-011"]));
  assert.equal(out.find((e) => e.source === "story-011")?.date, "2027-01-01"); // start, not end
});

test("only payouts strictly after `after` emit", () => {
  const out = storyStream(SERIES, config(), "story", cal("2027-01-12"));
  assert.deepEqual(out.map((e) => e.source), ["story-034"]);
});

test("non-story events are ignored", () => {
  const mixed = bundle([
    { type: "trainingpass", name: "Training Pass", start: "2027-01-01T22:00:00+00:00", end: "2027-01-31T22:00:00+00:00", predicted: true, key: "tp-001" } as EventsBundle["events"][number],
    story("story-011", "1m", "2027-01-01T22:00:00+00:00", "2027-01-12T22:00:00+00:00"),
  ]);
  const out = storyStream(mixed, config(), "story", cal("2026-01-01"));
  assert.deepEqual(out.map((e) => e.source), ["story-011"]);
});

test("buckets the end instant into the view timezone", () => {
  const out = storyStream(SERIES, config(), "story", cal("2026-01-01"), "Australia/Sydney");
  assert.equal(out.find((e) => e.source === "story-011")?.date, "2027-01-13"); // 22:00Z → next day in Sydney
});
