import { test } from "node:test";
import assert from "node:assert/strict";

import { generatorStream, generatorsFromBundle } from "./generator.ts";
import type { GeneratorSpec } from "./generator.ts";
import type { EventsBundle, AnchorRecord } from "../../bundle/events.gen.ts";

function spec(source: string, start: string, repeat: number, payload: Record<string, number>): GeneratorSpec {
  return { source, start, repeat, payload };
}

test("a generator emits its payload once a day from start for repeat days, then stops", () => {
  const out = generatorStream([spec("daily", "2026-06-09", 3, { free_carats: 50 })], "2026-06-01");
  assert.deepEqual(out, [
    { date: "2026-06-09", source: "daily", deltas: { free_carats: 50 } },
    { date: "2026-06-10", source: "daily", deltas: { free_carats: 50 } },
    { date: "2026-06-11", source: "daily", deltas: { free_carats: 50 } },
  ]);
});

test("a generator straddling the snapshot keeps its later days — cadence is computed from start", () => {
  const out = generatorStream([spec("daily", "2026-05-30", 5, { free_carats: 50 })], "2026-06-01");
  assert.deepEqual(out.map((e) => e.date), ["2026-06-02", "2026-06-03"]);
});

test("a generator stepping over a month boundary advances the calendar correctly", () => {
  const out = generatorStream([spec("daily", "2026-06-29", 4, { free_carats: 10 })], "2026-06-01");
  assert.deepEqual(out.map((e) => e.date), ["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"]);
});

test("generatorsFromBundle extracts inline generators, splitting off repeat", () => {
  const bundle: EventsBundle = {
    events: [
      {
        type: "anchor",
        start: "2025-08-07",
        end: "2025-08-07",
        predicted: false,
        key: "anchor-golden-week-2021",
        rewards: { generator: { free_carats: 564, repeat: 10 } },
      } satisfies AnchorRecord,
    ],
  };
  assert.deepEqual(generatorsFromBundle(bundle), [
    { source: "anchor-golden-week-2021", start: "2025-08-07", payload: { free_carats: 564 }, repeat: 10 },
  ]);
});

test("generatorsFromBundle anchors timestamped generators in the selected timezone", () => {
  const bundle: EventsBundle = {
    events: [
      {
        type: "anchor",
        start: "2025-08-07T22:00:00+00:00",
        end: "2025-08-07T22:00:00+00:00",
        predicted: false,
        key: "anchor-golden-week-2021",
        rewards: { generator: { free_carats: 564, repeat: 10 } },
      } satisfies AnchorRecord,
    ],
  };
  assert.deepEqual(generatorsFromBundle(bundle, "Australia/Sydney"), [
    { source: "anchor-golden-week-2021", start: "2025-08-08", payload: { free_carats: 564 }, repeat: 10 },
  ]);
});

test("a malformed generator (no payload, or non-numeric repeat) is skipped", () => {
  const bundle: EventsBundle = {
    events: [
      { type: "anchor", start: "2025-08-07", end: "2025-08-07", predicted: false, key: "no-payload", rewards: { generator: { repeat: 10 } } } satisfies AnchorRecord,
      { type: "anchor", start: "2025-08-08", end: "2025-08-08", predicted: false, key: "flat-only", rewards: { free_carats: 100 } } satisfies AnchorRecord,
    ],
  };
  assert.deepEqual(generatorsFromBundle(bundle), []);
});

test("the bundle generator round-trips through extraction into a daily emission run", () => {
  const bundle: EventsBundle = {
    events: [
      { type: "anchor", start: "2026-06-09", end: "2026-06-09", predicted: false, key: "anchor-x", rewards: { generator: { free_carats: 564, repeat: 10 } } } satisfies AnchorRecord,
    ],
  };
  const out = generatorStream(generatorsFromBundle(bundle), "2026-06-01");
  assert.equal(out.length, 10);
  assert.equal(out[0]?.date, "2026-06-09");
  assert.equal(out[9]?.date, "2026-06-18");
  assert.deepEqual(out[0]?.deltas, { free_carats: 564 });
});
