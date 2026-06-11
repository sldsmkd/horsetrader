import { test } from "node:test";
import assert from "node:assert/strict";

import { trainingPassStream, resolveTrainingPass } from "./trainingpass.ts";
import { cal } from "../dates.ts";
import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle, TrainingPassRecord } from "../../bundle/events.gen.ts";

const PREMIUM = {
  free_carats: 1000,
  paid_carats: 350,
  trainee_tickets: 2,
  support_tickets: 2,
  rainbow_crystal_shards: 1,
};

function config(premium: ConfigBundle["reward_maps"]["training-pass"]["premium"] | null = PREMIUM): ConfigBundle {
  return {
    reward_structures: {},
    reward_maps: premium === null ? {} : { "training-pass": { premium } },
    gacha: { spark_threshold: 200, carats_per_pull: 150, paid_daily_pull: 50, rarity_rates: {}, featured_rates: {} },
  };
}

function pass(key: string, start: string, end: string): TrainingPassRecord {
  return { type: "trainingpass", name: "Training Pass", start, end, predicted: true, key };
}

function bundle(events: EventsBundle["events"]): EventsBundle {
  return { events };
}

const SERIES = bundle([
  pass("training-pass-001", "2027-01-01T22:00:00+00:00", "2027-01-31T22:00:00+00:00"),
  pass("training-pass-002", "2027-02-01T22:00:00+00:00", "2027-03-03T22:00:00+00:00"),
]);

test("resolveTrainingPass: only an explicit `true` enables the premium track", () => {
  assert.equal(resolveTrainingPass({ trainingPass: true }), true);
  assert.equal(resolveTrainingPass({ trainingPass: false }), false);
  assert.equal(resolveTrainingPass({}), false);
  assert.equal(resolveTrainingPass(undefined), false);
  assert.equal(resolveTrainingPass({ trainingPass: "2027-01-01" }), false); // not a bare truthy boolean
});

test("the toggle off pays nothing", () => {
  assert.deepEqual(trainingPassStream(SERIES, config(), false, cal("2026-01-01")), []);
});

test("the boost lands on each event's end (bucketed), keyed by the event", () => {
  const out = trainingPassStream(SERIES, config(), true, cal("2026-01-01"));
  assert.deepEqual(
    out.map((e) => [e.date, e.source]),
    [
      ["2027-01-31", "training-pass-001"],
      ["2027-03-03", "training-pass-002"],
    ],
  );
  assert.deepEqual(out[0].deltas, PREMIUM);
});

test("only events ending strictly after `after` emit", () => {
  const out = trainingPassStream(SERIES, config(), true, cal("2027-01-31"));
  assert.deepEqual(out.map((e) => e.source), ["training-pass-002"]);
});

test("a missing premium row pays nothing even when toggled on", () => {
  assert.deepEqual(trainingPassStream(SERIES, config(null), true, cal("2026-01-01")), []);
});

test("non-trainingpass events are ignored", () => {
  const mixed = bundle([
    { type: "story", title: null, image: null, start: "2027-01-10T00:00:00+00:00", end: "2027-01-20T00:00:00+00:00", predicted: true, key: "story-x" } as EventsBundle["events"][number],
    pass("training-pass-001", "2027-01-01T22:00:00+00:00", "2027-01-31T22:00:00+00:00"),
  ]);
  const out = trainingPassStream(mixed, config(), true, cal("2026-01-01"));
  assert.deepEqual(out.map((e) => e.source), ["training-pass-001"]);
});

test("buckets the end instant into the view timezone", () => {
  const out = trainingPassStream(SERIES, config(), true, cal("2026-01-01"), "Australia/Sydney");
  assert.equal(out[0].date, "2027-02-01"); // 2027-01-31T22:00Z → next day in Sydney
});
