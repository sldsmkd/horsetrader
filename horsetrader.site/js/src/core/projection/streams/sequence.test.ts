import { test } from "node:test";
import assert from "node:assert/strict";

import { sequenceStream, sequencesFromBundle } from "./sequence.ts";
import type { SequenceSpec } from "./sequence.ts";
import type { EventsBundle, AnchoredEventRecord } from "../../bundle/events.gen.ts";

function spec(source: string, start: string, resource: string, amounts: (number | null)[]): SequenceSpec {
  return { source, start, resource, amounts };
}

function anchored(key: string, start: string, rewards: NonNullable<AnchoredEventRecord["rewards"]>): AnchoredEventRecord {
  return { type: "anchoredevent", relation: "after", anchor: "anni-1_5", start, end: start, predicted: false, key, rewards };
}

test("a sequence emits per consecutive day from start, skipping null (unpaid) days", () => {
  const out = sequenceStream([spec("login", "2026-06-09", "carats_free", [150, null, 150])], "2026-06-01");
  assert.deepEqual(out, [
    { date: "2026-06-09", source: "login", deltas: { carats_free: 150 } },
    { date: "2026-06-11", source: "login", deltas: { carats_free: 150 } },
  ]);
});

test("a null day advances the calendar but pays nothing — later days stay aligned", () => {
  const out = sequenceStream([spec("login", "2026-06-09", "carats_free", [150, 150, null, 150])], "2026-06-01");
  assert.deepEqual(out.map((e) => e.date), ["2026-06-09", "2026-06-10", "2026-06-12"]);
});

test("a sequence straddling the snapshot keeps its later days — cadence is computed from start", () => {
  const out = sequenceStream([spec("login", "2026-05-30", "carats_free", [150, 150, 150, 150, 150])], "2026-06-01");
  assert.deepEqual(out.map((e) => e.date), ["2026-06-02", "2026-06-03"]);
});

test("sequencesFromBundle extracts the inline sequence, normalising the type to a resource", () => {
  const bundle: EventsBundle = {
    events: [anchored("after-anni-1_5", "2026-07-20", { carats: 3000, sequence: { type: "carats", sequence: [150, 150, null, 150] } })],
  };
  assert.deepEqual(sequencesFromBundle(bundle), [
    { source: "after-anni-1_5", start: "2026-07-20", resource: "carats_free", amounts: [150, 150, null, 150] },
  ]);
});

test("a malformed sequence (no string type, or non-array sequence) is skipped", () => {
  const bundle: EventsBundle = {
    events: [
      anchored("bad-type", "2026-07-20", { sequence: { sequence: [150] } }),
      anchored("flat-only", "2026-07-21", { carats: 100 }),
    ],
  };
  assert.deepEqual(sequencesFromBundle(bundle), []);
});

test("the bundle sequence round-trips through extraction into a daily emission run", () => {
  const bundle: EventsBundle = {
    events: [anchored("after-anni-1_5", "2026-06-09", { sequence: { type: "carats", sequence: [150, 150, null, 150, 150, 150, 150, 150, null, 150, 150, 150] } })],
  };
  const out = sequenceStream(sequencesFromBundle(bundle), "2026-06-01");
  assert.equal(out.length, 10); // 12 days, 2 unpaid
  assert.equal(out[0]?.date, "2026-06-09");
  assert.deepEqual(out[0]?.deltas, { carats_free: 150 });
  assert.equal(out.reduce((sum, e) => sum + (e.deltas["carats_free"] ?? 0), 0), 1500);
});
