import { test } from "node:test";
import assert from "node:assert/strict";

import { createBundle } from "./access.ts";
import { TEST_CONFIG } from "./fixtures.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

const EVENTS: EventsBundle = {
  events: [{ type: "cm", name: "Summer CM", start: "2026-06-27", end: "2026-07-01", predicted: false, key: "cm-1" }],
};

const ACADEMY: Academy = {
  characters: { "char-1": { name: "Special Week", quote: null, icon: null, portrait: null } },
  supports: { "support-1": { character: "char-1", display: "Special Week", type: "speed", rarity: "ssr", title: null, release: "2021", thumbnail: null, art: null, aliases: [] } },
  trainees: {},
  courses: {},
  races: {},
  racetracks: {},
};

test("a lookup resolves a present key to its typed record", () => {
  const bundle = createBundle(EVENTS, ACADEMY, TEST_CONFIG);
  assert.equal(bundle.event("cm-1").type, "cm");
  assert.equal(bundle.character("char-1").name, "Special Week");
});

test("a miss throws — the ETL guarantees referential integrity, so it's a bug, not undefined", () => {
  const bundle = createBundle(EVENTS, ACADEMY, TEST_CONFIG);
  assert.throws(() => bundle.event("nope"), /no event for "nope"/);
  assert.throws(() => bundle.character("nope"), /no character for "nope"/);
  assert.throws(() => bundle.support("nope"), /no support for "nope"/);
  assert.throws(() => bundle.trainee("nope"), /no trainee for "nope"/);
});

test("all() returns every event in bake order — for selectors that scan", () => {
  const bundle = createBundle(EVENTS, ACADEMY, TEST_CONFIG);
  assert.deepEqual(bundle.all().map((e) => e.key), ["cm-1"]);
});

test("academy scans expose id-keyed entries for pure indexes", () => {
  const bundle = createBundle(EVENTS, ACADEMY, TEST_CONFIG);

  assert.deepEqual(bundle.characters().map(({ id, record }) => [id, record.name]), [["char-1", "Special Week"]]);
  assert.deepEqual(bundle.supports().map(({ id, record }) => [id, record.display]), [["support-1", "Special Week"]]);
  assert.deepEqual(bundle.trainees(), []);
});

test("event dates are projected to the selected timeline calendar at the access seam", () => {
  const events: EventsBundle = {
    events: [
      {
        type: "cm",
        name: "Late CM",
        start: "2026-06-10T22:00:00+00:00",
        end: "2026-06-20T22:00:00+00:00",
        predicted: false,
        key: "cm-late",
      },
    ],
  };
  const utc = createBundle(events, ACADEMY, TEST_CONFIG, "UTC").event("cm-late");
  const sydney = createBundle(events, ACADEMY, TEST_CONFIG, "Australia/Sydney").event("cm-late");

  assert.equal(utc.start, "2026-06-10");
  assert.equal(utc.end, "2026-06-20");
  assert.equal(sydney.start, "2026-06-11");
  assert.equal(sydney.end, "2026-06-21");
});
