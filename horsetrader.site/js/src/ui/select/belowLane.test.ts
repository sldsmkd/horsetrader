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
    { type: "trainee", rushable: true, contents: [], image: "/i.webp", start: "2026-06-10", end: "2026-06-15", predicted: false, key: "banner-1", rewards: { free_carats: 720 } },
    { type: "story", rushable: true, title: "A Story", contents: [], image: null, banner: null, art: null, start: "2026-06-14", end: "2026-06-20", predicted: true, key: "story-1", rewards: { free_carats: 200 } },
    { type: "anchor", start: "2026-06-25", end: "2026-06-25", predicted: false, key: "anchor-1", rewards: { free_carats: 50 } },
    { type: "cm", name: "Summer CM", start: "2026-06-27", end: "2026-07-01", predicted: false, key: "cm-1", rewards: { free_carats: 1000 } },
    { type: "scenario", title: null, image: null, art: null, start: "2026-07-20", end: "2026-08-01", predicted: false, key: "sce-1", rewards: { free_carats: 300 } },
    // A reward-less below-lane event (a PvP CM you didn't enter): no `rewards` at
    // all, yet it must still get a card — visibility is the appearance, not a payout.
    { type: "cm", name: "Autumn CM", start: "2026-08-10", end: "2026-08-14", predicted: false, key: "cm-2" },
  ],
};

const EMPTY_ACADEMY: Academy = { characters: {}, supports: {}, trainees: {} };
const NOW = "2026-06-08";

/** The real path: extract the events stream, add a login generator, fold. */
function projectFixture() {
  return project({ date: "2026-01-01", resources: {} }, [
    { stream: "events", emissions: eventStream(EVENTS, "2026-01-01") },
    { stream: "generators", emissions: [{ date: "2026-06-12", source: "daily-login", deltas: { free_carats: 50 } }] },
  ]);
}

test("below-lane cards: below-lane events only, resolved + positioned, sorted by date", () => {
  const cards = belowLaneCards(projectFixture(), createBundle(EVENTS, EMPTY_ACADEMY), createAxis({ origin: "2026-06-01", pxPerDay: 10 }), NOW);

  // The trainee banner (above-lane) and the daily-login (generators stream) are excluded.
  assert.deepEqual(cards.map((c) => c.key), ["story-1", "anchor-1", "cm-1", "sce-1", "cm-2"]);
  assert.deepEqual(cards.map((c) => c.kind), ["story", "anchor", "cm", "scenario", "cm"]);
});

test("a reward-less below-lane event still gets a card, with an empty reward", () => {
  const cards = belowLaneCards(projectFixture(), createBundle(EVENTS, EMPTY_ACADEMY), createAxis({ origin: "2026-06-01", pxPerDay: 10 }), NOW);
  const card = cards.find((c) => c.key === "cm-2");

  assert.ok(card, "the reward-less CM is on the lane — existence is the appearance, not a payout");
  assert.equal(card!.label, "Autumn CM");
  assert.deepEqual(card!.reward, {}); // no payout, but present
});

test("visibility is opt-out: an explicit `visible: false` hides the card, absence shows it", () => {
  // The flag isn't in the generated bundle type yet, so set it structurally.
  const events: EventsBundle = {
    events: [
      { type: "cm", name: "Hidden CM", start: "2026-09-01", end: "2026-09-05", predicted: false, key: "cm-hidden", visible: false } as EventsBundle["events"][number],
      { type: "cm", name: "Shown CM", start: "2026-09-10", end: "2026-09-15", predicted: false, key: "cm-shown" },
    ],
  };
  const projection = project({ date: "2026-01-01", resources: {} }, [{ stream: "events", emissions: eventStream(events, "2026-01-01") }]);
  const cards = belowLaneCards(projection, createBundle(events, EMPTY_ACADEMY), createAxis({ origin: "2026-06-01", pxPerDay: 10 }), NOW);

  assert.deepEqual(cards.map((c) => c.key), ["cm-shown"]); // only the visible one
});

test("each card resolves its label (name/title, falling back to key) and predicted flag", () => {
  const cards = belowLaneCards(projectFixture(), createBundle(EVENTS, EMPTY_ACADEMY), createAxis({ origin: "2026-06-01", pxPerDay: 10 }), NOW);
  const byKey = new Map(cards.map((c) => [c.key, c]));

  assert.equal(byKey.get("cm-1")!.label, "Summer CM");
  assert.equal(byKey.get("story-1")!.label, "A Story");
  assert.equal(byKey.get("anchor-1")!.label, "anchor-1"); // no name → the key
  assert.equal(byKey.get("sce-1")!.label, "sce-1"); // title null → the key
  assert.equal(byKey.get("story-1")!.predicted, true);
  assert.equal(byKey.get("cm-1")!.predicted, false);
});

test("x is true-to-date off the axis (arrival date = start) and reward is the event's own delta", () => {
  const cards = belowLaneCards(projectFixture(), createBundle(EVENTS, EMPTY_ACADEMY), createAxis({ origin: "2026-06-01", pxPerDay: 10 }), NOW);
  const byKey = new Map(cards.map((c) => [c.key, c]));

  assert.equal(byKey.get("story-1")!.date, "2026-06-14"); // start, not end
  assert.equal(byKey.get("story-1")!.x, 130); // 13 days × 10px
  assert.equal(byKey.get("cm-1")!.x, 260); // 2026-06-27 → 26 days
  assert.equal(byKey.get("sce-1")!.x, 490); // 2026-07-20 → 49 days

  // The card carries its own reward, not the day's subtotal.
  assert.deepEqual(byKey.get("cm-1")!.reward, { free_carats: 1000 });
  assert.deepEqual(byKey.get("anchor-1")!.reward, { free_carats: 50 });
});
