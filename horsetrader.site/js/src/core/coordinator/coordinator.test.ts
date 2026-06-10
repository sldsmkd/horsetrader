import { test } from "node:test";
import assert from "node:assert/strict";

import { createCoordinator } from "./coordinator.ts";
import { memoryStore, DOCUMENT_KEY } from "../persistence/storage.ts";
import { load } from "../persistence/index.ts";
import { cal } from "../projection/dates.ts";
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
const FAR = cal("2026-06-30"); // past every event

test("folds all channels from the snapshot forward into a queryable balance", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-01"), store });
  coord.update({ snapshot });
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 1000 + 100 + 150 + 20 });
});

test("a committed banner's spend (the claim) folds at its calendar start date, not the raw instant", () => {
  // Two regressions in one: (1) the claim debits at the banner's *start* — committing
  // earmarks resources as it opens, visible mid-run before the banner closes; (2) the bake
  // stores full instants, so the spend pass must bucket them to a calendar date like the
  // income streams, or the emission lands in a date-space nothing reads (silently dropped).
  const banners: EventsBundle = {
    events: [{ type: "support", contents: [], image: "", start: "2026-06-08T22:00:00+00:00", end: "2026-06-20T22:00:00+00:00", predicted: false, rushable: false, key: "sb" }],
  };
  const coord = createCoordinator({ bundle: banners, now: cal("2026-06-01"), store: memoryStore() });
  coord.update({ snapshot: { date: "2026-06-01", recordedAt: "2026-06-01T00:00:00.000Z", resources: { free_carats: 100000, support_tickets: 50 } } });
  const START = cal("2026-06-08"); // calendar bucket of the start instant
  const BEFORE = cal("2026-06-07"); // the day before the banner opens
  const END = cal("2026-06-20");

  assert.deepEqual(coord.balanceAt(END), { free_carats: 100000, support_tickets: 50 });
  coord.update({ commitments: { sb: 1 } }); // 200 pulls: 50 tickets + 150 × 150 free carats
  // The claim lands at the start: not yet debited the day before it opens...
  assert.deepEqual(coord.balanceAt(BEFORE), { free_carats: 100000, support_tickets: 50 });
  // ...debited from the start onward (tickets emptied, free carats down 22,500), held to end.
  assert.deepEqual(coord.balanceAt(START), { free_carats: 100000 - 22500, support_tickets: 0 });
  assert.deepEqual(coord.balanceAt(END), { free_carats: 100000 - 22500, support_tickets: 0 });
  // ...while the banner's own available stays pre-spend (self-excluded).
  assert.deepEqual(coord.bannerAvailable("sb"), { free_carats: 100000, support_tickets: 50 });
});

test("rushing an event re-folds its discrete payout from end to start, live", () => {
  // A span-event: rewards at end 2026-06-15 unrushed, pulled forward to start 2026-06-05 rushed.
  const span: EventsBundle = {
    events: [{ type: "trainee", contents: [], image: "", start: "2026-06-05", end: "2026-06-15", predicted: false, rushable: true, key: "ev", rewards: { free_carats: 100 } }],
  };
  const coord = createCoordinator({ bundle: span, now: cal("2026-06-01"), store: memoryStore() });
  coord.update({ snapshot });
  const MID = cal("2026-06-10"); // inside the run — before end, after start
  // Unrushed: the payout lands at end, so mid-run the balance is just the base.
  assert.deepEqual(coord.balanceAt(MID), { free_carats: 1000 });
  // Rushed: update re-folds → the payout now lands at start, visible mid-run.
  coord.update({ rushed: { ev: "2026-06-02T00:00:00.000Z" } });
  assert.deepEqual(coord.balanceAt(MID), { free_carats: 1100 });
});

test("with no snapshot, the origin is `now` and the base is empty", () => {
  const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-01"), store: memoryStore() });
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 270 });
});

test("toggling a channel off removes its contribution; back on restores it", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-01"), store });
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
  const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-01"), store: memoryStore() });
  assert.deepEqual(coord.channels(), [
    { name: "events", enabled: true },
    { name: "generator", enabled: true },
    { name: "sequence", enabled: true },
    { name: "routine", enabled: true },
    { name: "team-trials", enabled: true },
  ]);
  coord.setEnabled("events", false);
  assert.equal(coord.channels().find((c) => c.name === "events")?.enabled, false);
});

test("toggling an unknown channel is a no-op", () => {
  const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-01"), store: memoryStore() });
  coord.setEnabled("nonsense", false);
  assert.equal(coord.channels().length, 5);
  assert.deepEqual(coord.balanceAt(FAR), { free_carats: 270 });
});

test("toggles are ephemeral — never persisted into the plan", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-01"), store });
  coord.update({ snapshot });
  coord.setEnabled("generator", false);

  // The saved plan carries no channel state; a fresh coordinator starts all-on.
  assert.equal(load(store).doc.snapshot?.date, "2026-06-01");
  const fresh = createCoordinator({ bundle: bundle(), now: cal("2026-06-01"), store });
  assert.deepEqual(fresh.balanceAt(FAR), { free_carats: 1270 });
});

test("update persists the plan and recomputes against the new base", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-01"), store });
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

  const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-10"), store });
  assert.deepEqual(coord.document().rushed, { "banner-1": "2026-06-05T00:00:00.000Z" });
  // The sweep rewrote the store, so a reload sees the pruned map too.
  assert.deepEqual(load(store).doc.rushed, { "banner-1": "2026-06-05T00:00:00.000Z" });
});

test("a rushed map that is all-past prunes to omitted, not an empty object", () => {
  const store = memoryStore();
  store.write(DOCUMENT_KEY, JSON.stringify({ version: 1, rushed: { "anchor-1": "2026-06-05T00:00:00.000Z" } }));
  const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-10"), store });
  assert.equal(coord.document().rushed, undefined);
});

test("subscribers fire on a mutation, exactly once, and never on a read", () => {
  const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-01"), store: memoryStore() });
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
    const coord = createCoordinator({ bundle: bundle(), now: cal("2026-06-01"), store });
    assert.equal(coord.recovered(), true);
    assert.deepEqual(coord.balanceAt(FAR), { free_carats: 270 });
  } finally {
    console.warn = warn;
    console.error = error;
  }
});
