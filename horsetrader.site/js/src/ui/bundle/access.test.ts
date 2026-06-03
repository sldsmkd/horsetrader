import { test } from "node:test";
import assert from "node:assert/strict";

import { createBundle } from "./access.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

const EVENTS: EventsBundle = {
  events: [{ type: "cm", name: "Summer CM", start: "2026-06-27", end: "2026-07-01", predicted: false, key: "cm-1" }],
};

const ACADEMY: Academy = {
  characters: { "char-1": { name: "Special Week", quote: null, icon: null, portrait: null } },
  supports: {},
  trainees: {},
};

test("a lookup resolves a present key to its typed record", () => {
  const bundle = createBundle(EVENTS, ACADEMY);
  assert.equal(bundle.event("cm-1").type, "cm");
  assert.equal(bundle.character("char-1").name, "Special Week");
});

test("a miss throws — the ETL guarantees referential integrity, so it's a bug, not undefined", () => {
  const bundle = createBundle(EVENTS, ACADEMY);
  assert.throws(() => bundle.event("nope"), /no event for "nope"/);
  assert.throws(() => bundle.character("nope"), /no character for "nope"/);
  assert.throws(() => bundle.trainee("nope"), /no trainee for "nope"/);
});
