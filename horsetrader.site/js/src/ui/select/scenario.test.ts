import test from "node:test";
import assert from "node:assert/strict";

import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";
import { cal } from "../../core/projection/dates.ts";
import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import { activeScenario } from "./scenario.ts";

const academy: Academy = { characters: {}, courses: {}, races: {}, racetracks: {}, supports: {}, trainees: {} };

function bundle(events: EventsBundle["events"] = []): ReturnType<typeof createBundle> {
  return createBundle({ events }, academy, TEST_CONFIG, "UTC");
}

test("activeScenario returns the latest scenario launch at or before the date", () => {
  const b = bundle([
    { type: "scenario", title: "URA Finals", image: "/thumb-1.webp", art: "/art-1.webp", start: "2026-01-01T22:00:00+00:00", end: "2026-01-01T22:00:00+00:00", predicted: false, key: "scenario-01" },
    { type: "story", title: "Story", contents: [], image: null, banner: null, art: null, era: "1m", start: "2026-02-01T22:00:00+00:00", end: "2026-02-10T22:00:00+00:00", predicted: false, key: "story-1" },
    { type: "scenario", title: "Grand Live", image: "/thumb-4.webp", art: "/art-4.webp", start: "2026-07-20T22:00:00+00:00", end: "2026-07-20T22:00:00+00:00", predicted: true, key: "scenario-04" },
  ]);

  assert.equal(activeScenario(b, cal("2025-12-31")), null);
  assert.deepEqual(activeScenario(b, cal("2026-06-01")), {
    key: "scenario-01",
    title: "URA Finals",
    image: "/art-1.webp",
    date: cal("2026-01-01"),
    predicted: false,
    fadeToBlack: 0,
  });
  assert.deepEqual(activeScenario(b, cal("2026-08-01")), {
    key: "scenario-04",
    title: "Grand Live",
    image: "/art-4.webp",
    date: cal("2026-07-20"),
    predicted: true,
    fadeToBlack: 0,
  });
});

test("activeScenario falls back to thumbnail art and skips image-less scenarios", () => {
  const b = bundle([
    { type: "scenario", title: "Missing", image: null, art: null, start: "2026-01-01", end: "2026-01-01", predicted: false, key: "scenario-missing" },
    { type: "scenario", title: "Thumbnail Only", image: "/thumb.webp", art: null, start: "2026-02-01", end: "2026-02-01", predicted: false, key: "scenario-thumb" },
  ]);

  assert.deepEqual(activeScenario(b, cal("2026-01-15")), null);
  assert.equal(activeScenario(b, cal("2026-03-01"))?.image, "/thumb.webp");
});

test("activeScenario fades out before the prelaunch window, then brightens the incoming art", () => {
  const b = bundle([
    { type: "scenario", title: "Outgoing", image: "/thumb-1.webp", art: "/art-1.webp", start: "2026-01-01", end: "2026-01-01", predicted: false, key: "scenario-01" },
    { type: "scenario", title: "Incoming", image: "/thumb-2.webp", art: "/art-2.webp", start: "2026-07-20", end: "2026-07-20", predicted: false, key: "scenario-02" },
  ]);

  assert.deepEqual(activeScenario(b, cal("2026-06-30")), {
    key: "scenario-01",
    title: "Outgoing",
    image: "/art-1.webp",
    date: cal("2026-01-01"),
    predicted: false,
    fadeToBlack: 0,
  });
  assert.equal(activeScenario(b, cal("2026-07-05"))?.fadeToBlack, 0.5);
  assert.equal(activeScenario(b, cal("2026-07-10"))?.fadeToBlack, 1);
  assert.equal(activeScenario(b, cal("2026-07-15"))?.fadeToBlack, 1);
  assert.deepEqual(activeScenario(b, cal("2026-07-16")), {
    key: "scenario-02",
    title: "Incoming",
    image: "/art-2.webp",
    date: cal("2026-07-20"),
    predicted: false,
    fadeToBlack: 1,
  });
  assert.equal(activeScenario(b, cal("2026-07-18"))?.fadeToBlack, 0.5);
  assert.equal(activeScenario(b, cal("2026-07-19"))?.fadeToBlack, 1 / 4);
  assert.deepEqual(activeScenario(b, cal("2026-07-20")), {
    key: "scenario-02",
    title: "Incoming",
    image: "/art-2.webp",
    date: cal("2026-07-20"),
    predicted: false,
    fadeToBlack: 0,
  });
});
