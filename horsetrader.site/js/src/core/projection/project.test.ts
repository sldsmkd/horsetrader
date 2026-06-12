import { test } from "node:test";
import assert from "node:assert/strict";

import { project } from "./project.ts";
import type { Snapshot } from "../persistence/document.ts";
import { cal } from "./dates.ts";

const snapshot: Snapshot = { date: "2026-06-01", recordedAt: "2026-06-01T00:00:00.000Z", resources: { free_carats: 1000 } };

test("project folds streams from the snapshot forward into a queryable balance series", () => {
  const { series } = project(snapshot, [
    {
      stream: "ground.events",
      emissions: [
        { date: cal("2026-06-10"), source: "banner-1", deltas: { free_carats: 100 } },
        { date: cal("2026-06-20"), source: "banner-2", deltas: { free_carats: 50 } },
      ],
    },
  ]);
  assert.deepEqual(series.balanceAt(cal("2026-06-01")), { free_carats: 1000 });
  assert.deepEqual(series.balanceAt(cal("2026-06-15")), { free_carats: 1100 });
  assert.deepEqual(series.balanceAt(cal("2026-06-30")), { free_carats: 1150 });
});

test("the ledger keeps per-source attribution for every contributing event", () => {
  const { ledger } = project(snapshot, [
    { stream: "ground.events", emissions: [{ date: cal("2026-06-10"), source: "banner-1", deltas: { free_carats: 100, trainee_tickets: 2 } }] },
  ]);
  assert.deepEqual(ledger, [
    { date: "2026-06-10", stream: "ground.events", source: "banner-1", resource: "free_carats", amount: 100 },
    { date: "2026-06-10", stream: "ground.events", source: "banner-1", resource: "trainee_tickets", amount: 2 },
  ]);
});

test("adding a stream is a change to the input list, not the fold; balances combine across streams", () => {
  const events = { stream: "ground.events", emissions: [{ date: cal("2026-06-10"), source: "banner-1", deltas: { free_carats: 100 } }] };
  const commitments = { stream: "commitments", emissions: [{ date: cal("2026-06-10"), source: "banner-1", deltas: { free_carats: -150 } }] };

  const before = project(snapshot, [events]);
  assert.deepEqual(before.series.balanceAt(cal("2026-06-10")), { free_carats: 1100 });

  const after = project(snapshot, [events, commitments]);
  assert.deepEqual(after.series.balanceAt(cal("2026-06-10")), { free_carats: 950 });
});

test("project with no streams yields an empty ledger and base-only balances", () => {
  const out = project(snapshot, []);
  assert.deepEqual(out.ledger, []);
  assert.deepEqual(out.series.dates, []);
  assert.equal(out.series.extent, null);
  assert.deepEqual(out.series.balanceAt(cal("2026-06-30")), { free_carats: 1000 });
});
