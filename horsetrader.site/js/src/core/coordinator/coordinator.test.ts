import { test } from "node:test";
import assert from "node:assert/strict";

import { createCoordinator } from "./coordinator.ts";
import { memoryStore, DOCUMENT_KEY } from "../persistence/storage.ts";
import { load } from "../persistence/index.ts";
import type { EventsBundle } from "../bundle/events.gen.ts";

/**
 * A bundle exercising all three channels after the snapshot date:
 *   events    +100 free_carats on 2026-06-10
 *   generator  +50 free_carats/day x3 from 2026-06-09  (= 150)
 *   sequence   +10 free_carats/day x2 from 2026-06-09  (=  20)
 */
function bundle(): EventsBundle {
  return {
    events: [
      { type: "trainee", contents: [], image: "", start: "2026-06-10", end: "2026-06-10", predicted: false, rushable: false, key: "banner-1", rewards: { free_carats: 100 } },
      { type: "anchor", start: "2026-06-09", end: "2026-06-09", predicted: false, key: "anchor-1", rewards: { generator: { free_carats: 50, repeat: 3 } } },
      { type: "anchoredevent", relation: "after", anchor: "x", start: "2026-06-09", end: "2026-06-09", predicted: false, key: "seq-1", rewards: { sequence: { type: "free_carats", sequence: [10, 10] } } },
    ],
  };
}

const snapshot = { date: "2026-06-01", recordedAt: "2026-06-01T00:00:00.000Z", resources: { free_carats: 1000 } };
const FAR = "2026-06-30"; // past every event

test("folds all channels from the snapshot forward into a queryable balance", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), now: "2026-06-01", store });
  coord.update({ snapshot });
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 1000 + 100 + 150 + 20 });
});

test("with no snapshot, the origin is `now` and the base is empty", () => {
  const coord = createCoordinator({ bundle: bundle(), now: "2026-06-01", store: memoryStore() });
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 270 });
});

test("toggling a channel off removes its contribution; back on restores it", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), now: "2026-06-01", store });
  coord.update({ snapshot });

  coord.setEnabled("generator", false);
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 1120 }); // 1270 - 150

  coord.setEnabled("sequence", false);
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 1100 }); // - 20 more

  coord.setEnabled("generator", true);
  coord.setEnabled("sequence", true);
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 1270 });
});

test("channels() reports every channel and its enabled state", () => {
  const coord = createCoordinator({ bundle: bundle(), now: "2026-06-01", store: memoryStore() });
  assert.deepEqual(coord.channels(), [
    { name: "events", enabled: true },
    { name: "generator", enabled: true },
    { name: "sequence", enabled: true },
  ]);
  coord.setEnabled("events", false);
  assert.equal(coord.channels().find((c) => c.name === "events")?.enabled, false);
});

test("toggling an unknown channel is a no-op", () => {
  const coord = createCoordinator({ bundle: bundle(), now: "2026-06-01", store: memoryStore() });
  coord.setEnabled("nonsense", false);
  assert.equal(coord.channels().length, 3);
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 270 });
});

test("toggles are ephemeral — never persisted into the plan", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), now: "2026-06-01", store });
  coord.update({ snapshot });
  coord.setEnabled("generator", false);

  // The saved plan carries no channel state; a fresh coordinator starts all-on.
  assert.equal(load(store).doc.snapshot?.date, "2026-06-01");
  const fresh = createCoordinator({ bundle: bundle(), now: "2026-06-01", store });
  assert.deepEqual(fresh.balanceAt(FAR), { free_carats: 1270 });
});

test("update persists the plan and recomputes against the new base", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), now: "2026-06-01", store });
  coord.update({ snapshot });
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 1270 });

  coord.update({ snapshot: { date: "2026-06-01", recordedAt: "2026-06-01T00:00:00.000Z", resources: { free_carats: 5000 } } });
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 5270 });
  assert.equal(load(store).doc.snapshot?.resources.free_carats, 5000);
});

test("on load, rushed entries for ended/unknown events are pruned and persisted", () => {
  const store = memoryStore();
  store.write(
    DOCUMENT_KEY,
    JSON.stringify({
      version: 1,
      rushed: {
        "banner-1": "2026-06-05T00:00:00.000Z", // ends 2026-06-10 — still rushable at now
        "anchor-1": "2026-06-05T00:00:00.000Z", // ended 2026-06-09 — past, drop
        ghost: "2026-06-05T00:00:00.000Z", //       not in the bundle — drop
      },
    }),
  );

  const coord = createCoordinator({ bundle: bundle(), now: "2026-06-10", store });
  assert.deepEqual(coord.document().rushed, { "banner-1": "2026-06-05T00:00:00.000Z" });
  // The sweep rewrote the store, so a reload sees the pruned map too.
  assert.deepEqual(load(store).doc.rushed, { "banner-1": "2026-06-05T00:00:00.000Z" });
});

test("a rushed map that is all-past prunes to omitted, not an empty object", () => {
  const store = memoryStore();
  store.write(DOCUMENT_KEY, JSON.stringify({ version: 1, rushed: { "anchor-1": "2026-06-05T00:00:00.000Z" } }));
  const coord = createCoordinator({ bundle: bundle(), now: "2026-06-10", store });
  assert.equal(coord.document().rushed, undefined);
});

test("subscribers fire on a mutation, exactly once, and never on a read", () => {
  const coord = createCoordinator({ bundle: bundle(), now: "2026-06-01", store: memoryStore() });
  let notals = 0;
  const off = coord.subscribe(() => notals++);

  coord.balanceAt(FAR);
  coord.projection();
  coord.document();
  coord.channels();
  assert.equal(notals, 0); // reads never broadcast — the scrub path stays safe

  coord.update({ snapshot });
  assert.equal(notals, 1); // a mutation fires exactly once, never twice

  coord.setEnabled("generator", false);
  assert.equal(notals, 2); // a toggle is a recompute too

  coord.setEnabled("nonsense", false);
  assert.equal(notals, 2); // an unknown channel does not recompute, so does not notify

  off();
  coord.update({ snapshot });
  assert.equal(notals, 2); // unsubscribe stops delivery
});

test("an unreadable stored plan surfaces recovered and still folds (clean base)", () => {
  const store = memoryStore();
  const { warn, error } = console;
  console.warn = () => {};
  console.error = () => {};
  try {
    store.write(DOCUMENT_KEY, "{not json");
    const coord = createCoordinator({ bundle: bundle(), now: "2026-06-01", store });
    assert.equal(coord.recovered(), true);
    assert.deepEqual(coord.balanceAt(FAR), { free_carats: 270 });
  } finally {
    console.warn = warn;
    console.error = error;
  }
});
