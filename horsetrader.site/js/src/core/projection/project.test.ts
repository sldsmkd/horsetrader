import { test } from "node:test";
import assert from "node:assert/strict";

import { project } from "./project.ts";
import { eventStream } from "./streams/events.ts";
import type { Snapshot } from "../persistence/document.ts";
import type { EventsBundle, TraineeBannerRecord } from "../bundle/events.gen.ts";

function banner(key: string, end: string, rewards: NonNullable<TraineeBannerRecord["rewards"]>): TraineeBannerRecord {
  return { type: "trainee", contents: [], image: "", start: end, end, predicted: false, rushable: false, key, rewards };
}

const snapshot: Snapshot = { date: "2026-06-01", resources: { carats_free: 1000 } };

test("project folds streams from the snapshot forward into a queryable balance series", () => {
  const bundle: EventsBundle = {
    events: [banner("banner-1", "2026-06-10", { carats: 100 }), banner("banner-2", "2026-06-20", { carats: 50 })],
  };
  const { series } = project(snapshot, [{ stream: "events", emissions: eventStream(bundle, snapshot.date) }]);
  assert.deepEqual(series.balanceAt("2026-06-01"), { carats_free: 1000 });
  assert.deepEqual(series.balanceAt("2026-06-15"), { carats_free: 1100 });
  assert.deepEqual(series.balanceAt("2026-06-30"), { carats_free: 1150 });
});

test("the ledger keeps per-source attribution for every contributing event", () => {
  const bundle: EventsBundle = {
    events: [banner("banner-1", "2026-06-10", { carats: 100, trainee_tickets: 2 })],
  };
  const { ledger } = project(snapshot, [{ stream: "events", emissions: eventStream(bundle, snapshot.date) }]);
  assert.deepEqual(ledger, [
    { date: "2026-06-10", stream: "events", source: "banner-1", resource: "carats_free", amount: 100 },
    { date: "2026-06-10", stream: "events", source: "banner-1", resource: "trainee_tickets", amount: 2 },
  ]);
});

test("adding a stream is a change to the input list, not the fold; balances combine across streams", () => {
  const bundle: EventsBundle = { events: [banner("banner-1", "2026-06-10", { carats: 100 })] };
  const events = { stream: "events", emissions: eventStream(bundle, snapshot.date) };
  const spends = { stream: "spends", emissions: [{ date: "2026-06-10", source: "banner-1", deltas: { carats_free: -150 } }] };

  const before = project(snapshot, [events]);
  assert.deepEqual(before.series.balanceAt("2026-06-10"), { carats_free: 1100 });

  const after = project(snapshot, [events, spends]);
  assert.deepEqual(after.series.balanceAt("2026-06-10"), { carats_free: 950 });
});
