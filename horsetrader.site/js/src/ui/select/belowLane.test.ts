import { test } from "node:test";
import assert from "node:assert/strict";

import { belowLaneCards } from "./belowLane.ts";
import { createBundle } from "../bundle/access.ts";
import { createAxis } from "../axis.ts";
import { eventStream } from "../../core/projection/streams/events.ts";
import { project } from "../../core/projection/index.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

const EVENTS: EventsBundle = {
  events: [
    { type: "trainee", rushable: true, contents: [], image: "/i.webp", start: "2026-06-10", end: "2026-06-15", predicted: false, key: "banner-1", rewards: { carats: 720 } },
    { type: "story", rushable: true, title: "A Story", contents: [], image: null, banner: null, art: null, start: "2026-06-14", end: "2026-06-20", predicted: true, key: "story-1", rewards: { carats: 200 } },
    { type: "anchor", start: "2026-06-25", end: "2026-06-25", predicted: false, key: "anchor-1", rewards: { carats: 50 } },
    { type: "cm", name: "Summer CM", start: "2026-06-27", end: "2026-07-01", predicted: false, key: "cm-1", rewards: { carats: 1000 } },
    { type: "scenario", title: null, image: null, art: null, start: "2026-07-20", end: "2026-08-01", predicted: false, key: "sce-1", rewards: { carats: 300 } },
  ],
};

const EMPTY_ACADEMY: Academy = { characters: {}, supports: {}, trainees: {} };

/** The real path: extract the events stream, add a login generator, fold. */
function projectFixture() {
  return project({ date: "2026-01-01", resources: {} }, [
    { stream: "events", emissions: eventStream(EVENTS, "2026-01-01") },
    { stream: "generators", emissions: [{ date: "2026-06-12", source: "daily-login", deltas: { carats_free: 50 } }] },
  ]);
}

test("below-lane cards: below-lane events only, resolved + positioned, sorted by date", () => {
  const cards = belowLaneCards(projectFixture(), createBundle(EVENTS, EMPTY_ACADEMY), createAxis({ origin: "2026-06-01", pxPerDay: 10 }));

  // The trainee banner (above-lane) and the daily-login (generators stream) are excluded.
  assert.deepEqual(cards.map((c) => c.key), ["story-1", "anchor-1", "cm-1", "sce-1"]);
  assert.deepEqual(cards.map((c) => c.kind), ["story", "anchor", "cm", "scenario"]);
});

test("each card resolves its label (name/title, falling back to key) and predicted flag", () => {
  const cards = belowLaneCards(projectFixture(), createBundle(EVENTS, EMPTY_ACADEMY), createAxis({ origin: "2026-06-01", pxPerDay: 10 }));
  const byKey = new Map(cards.map((c) => [c.key, c]));

  assert.equal(byKey.get("cm-1")!.label, "Summer CM");
  assert.equal(byKey.get("story-1")!.label, "A Story");
  assert.equal(byKey.get("anchor-1")!.label, "anchor-1"); // no name → the key
  assert.equal(byKey.get("sce-1")!.label, "sce-1"); // title null → the key
  assert.equal(byKey.get("story-1")!.predicted, true);
  assert.equal(byKey.get("cm-1")!.predicted, false);
});

test("x is true-to-date off the axis (posting date = end) and reward is the event's own delta", () => {
  const cards = belowLaneCards(projectFixture(), createBundle(EVENTS, EMPTY_ACADEMY), createAxis({ origin: "2026-06-01", pxPerDay: 10 }));
  const byKey = new Map(cards.map((c) => [c.key, c]));

  assert.equal(byKey.get("story-1")!.date, "2026-06-20");
  assert.equal(byKey.get("story-1")!.x, 190); // 19 days × 10px
  assert.equal(byKey.get("cm-1")!.x, 300); // 2026-07-01 → 30 days
  assert.equal(byKey.get("sce-1")!.x, 610); // 2026-08-01 → 61 days

  // The card carries its own reward, not the day's subtotal — carats → carats_free.
  assert.deepEqual(byKey.get("cm-1")!.reward, { carats_free: 1000 });
  assert.deepEqual(byKey.get("anchor-1")!.reward, { carats_free: 50 });
});
