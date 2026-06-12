import { test } from "node:test";
import assert from "node:assert/strict";

import type { ConfigBundle } from "../bundle/config.gen.ts";
import type { EventsBundle } from "../bundle/events.gen.ts";
import { memoryStore } from "../persistence/storage.ts";
import { cal } from "../projection/dates.ts";
import { createCoordinator } from "./coordinator.ts";
import { buildRegistry, DEFAULT_STREAMS } from "./registry.ts";
import type { Stream } from "./stream.ts";

/**
 * A minimal baked config: just enough rows for the graded claimers, the
 * synthesisers and the gacha math. Values are fake; shapes are real.
 */
function config(): ConfigBundle {
  return {
    reward_structures: {
      dailies: { free_carats: 75 },
      "weekly-login": { sequence: { type: "free_carats", sequence: [50, null, null, null, null, null, 150] } },
      "daily-carats": { paid_carats: 500, generator: { free_carats: 50, repeat: 30 } },
    },
    reward_maps: {
      "champions-meeting": { "Group B 1st": { free_carats: 1000, support_tickets: 2 } },
      "story-1m": { sweetie: { free_carats: 300 }, focused: { free_carats: 900 } },
      "training-pass": { premium: { free_carats: 1000, paid_carats: 350 } },
      "team-trials": { "5:retention": { free_carats: 225 } },
      "club-rank": { "B+": { free_carats: 425 } },
    },
    gacha: { carats_per_pull: 150, paid_daily_pull: 50, spark_threshold: 200 },
  } as unknown as ConfigBundle;
}

/** A pinned bundle slice: one of each interesting record, real shapes, fake numbers. */
function bundle(): EventsBundle {
  return {
    events: [
      // ground truth: a holiday with discrete + generator facets on ONE key.
      { type: "holiday", name: "Golden Week", start: "2026-06-05", end: "2026-06-08", predicted: false, key: "holiday-gw", rewards: { free_carats: 600, generator: { free_carats: 50, repeat: 3 } } },
      // a play-gated mission (claimed by play.missions)…
      { type: "mission", title: "Grindy", start: "2026-06-04", end: "2026-06-14", predicted: false, key: "mission-grindy", rewards: { free_carats: 400 } },
      // …and an anniversary mission (separate type — universal, rides the complement).
      { type: "anniversarymission", title: "Anniv", start: "2026-06-04", end: "2026-06-14", predicted: false, key: "mission-anniv", rewards: { free_carats: 250 } },
      // graded claimers' records: a CM (no baked reward), a story with an era, a training pass.
      { type: "cm", name: "Taurus", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "cm-2026-06", rewards: {} },
      { type: "story", title: "Tale", era: "1m", start: "2026-06-09", end: "2026-06-19", predicted: false, key: "story-tale", rewards: {} },
      { type: "trainingpass", start: "2026-06-01", end: "2026-06-30", predicted: false, key: "training-pass-1", rewards: { free_carats: 120 } },
      // a banner — pulls on the face must never bank; commitments claim it.
      { type: "support", contents: [], image: "", start: "2026-06-12", end: "2026-06-22", predicted: false, key: "banner-kita", rewards: { pulls: 10 } },
      { type: "trainee", contents: [], image: "", start: "2026-06-14", end: "2026-06-24", predicted: false, key: "banner-sakura", rewards: { pulls: 10 } },
    ],
  } as unknown as EventsBundle;
}

const NOW = cal("2026-06-01");
const FAR = cal("2026-12-31");
const snapshot = { date: "2026-06-01", recordedAt: "2026-06-01T00:00:00.000Z", resources: { free_carats: 10000 } };

function coordinator(streams?: readonly Stream[]) {
  const coord = createCoordinator({ bundle: bundle(), config: config(), now: NOW, store: memoryStore(), streams });
  coord.saveSnapshot(snapshot);
  return coord;
}

// ── registry assertions ─────────────────────────────────────────────────────

test("registry: a doubly-claimed type fails to construct", () => {
  const dup: Stream = { id: "x.dup", claims: ["cm"], mints: [], enabled: () => true, events: () => [] };
  assert.throws(() => buildRegistry([...DEFAULT_STREAMS, dup], bundle()), /claimed by both/);
});

test("registry: two complement claimers fail to construct", () => {
  const second: Stream = { id: "x.ground", claims: "complement", mints: [], enabled: () => true, events: () => [] };
  assert.throws(() => buildRegistry([...DEFAULT_STREAMS, second], bundle()), /two complement claimers/);
});

test("registry: a mint prefix colliding with a baked key fails to construct", () => {
  const clash: Stream = { id: "x.clash", claims: [], mints: ["banner-"], enabled: () => true, events: () => [] };
  assert.throws(() => buildRegistry([...DEFAULT_STREAMS, clash], bundle()), /collides with baked key/);
});

test("registry: the full roster constructs against the real shapes", () => {
  const registry = buildRegistry(DEFAULT_STREAMS, bundle());
  assert.equal(registry.streams.length, 10);
});

// ── the settled world (the render source) ───────────────────────────────────

test("settled world: faces are resolved by the engine — CM stamped, story graded, premium boosted", () => {
  const coord = coordinator();
  coord.setPlay("custom", { weeklyPlay: "twoDays", teamTrials: "rank5", missions: "no", storyEvents: "major", championsMeeting: "groupBWinner", shopTickets: "none" });
  coord.setSubscriptions({ trainingPass: true });

  const byKey = new Map(coord.settledEvents().map((e) => [e.key, e]));
  assert.deepEqual(byKey.get("cm-2026-06")!.rewards, { free_carats: 1000, support_tickets: 2 });
  assert.deepEqual(byKey.get("story-tale")!.rewards, { free_carats: 900 }); // era 1m × focused
  assert.deepEqual(byKey.get("training-pass-1")!.rewards, { free_carats: 120 + 1000, paid_carats: 350 });
  // pulls are banner-scoped: never on the face (read off the record at spend).
  assert.deepEqual(byKey.get("banner-kita")!.rewards, {});
});

test("settled world: compound facets expand into invisible children under the parent key", () => {
  const coord = coordinator();
  const children = coord.settledEvents().filter((e) => e.key.startsWith("holiday-gw-"));
  assert.equal(children.length, 3); // generator repeat: 3
  assert.ok(children.every((c) => !c.visible && c.record === null));
  assert.deepEqual(children[0]!.rewards, { free_carats: 50 });
  // the parent keeps its discrete face and stays visible.
  const parent = coord.settledEvents().find((e) => e.key === "holiday-gw")!;
  assert.equal(parent.visible, true);
  assert.deepEqual(parent.rewards, { free_carats: 600 });
});

test("enabled is presence: missions off ⇒ the mission leaves world AND ledger; anniversary missions stay", () => {
  const coord = coordinator(); // default play style: missions "no" (sweetie default preset)
  coord.setPlay("custom", { weeklyPlay: "twoDays", teamTrials: "rank5", missions: "no", storyEvents: "story", championsMeeting: "skip", shopTickets: "none" });
  const keys = new Set(coord.settledEvents().map((e) => e.key));
  assert.ok(!keys.has("mission-grindy"));
  assert.ok(keys.has("mission-anniv")); // separate type — universal, never gated

  coord.setPlay("custom", { weeklyPlay: "twoDays", teamTrials: "rank5", missions: "yes", storyEvents: "story", championsMeeting: "skip", shopTickets: "none" });
  assert.ok(new Set(coord.settledEvents().map((e) => e.key)).has("mission-grindy"));
});

test("grading is the face, not the gate: CM at skip stays on the lane, unpriced", () => {
  const coord = coordinator();
  coord.setPlay("custom", { weeklyPlay: "twoDays", teamTrials: "rank5", missions: "no", storyEvents: "story", championsMeeting: "skip", shopTickets: "none" });
  const cm = coord.settledEvents().find((e) => e.key === "cm-2026-06")!;
  assert.equal(cm.visible, true);
  assert.deepEqual(cm.rewards, {});
});

// ── the fold (money derivation, once) ───────────────────────────────────────

test("fold: pays faces at end, expansion children per-day, nothing on or before the snapshot", () => {
  const coord = coordinator();
  coord.setPlay("custom", { weeklyPlay: "twoDays", teamTrials: "rank4", missions: "no", storyEvents: "story", championsMeeting: "skip", shopTickets: "none" });
  // rank4 has no row in the test config ⇒ team-trials inert; twoDays routine pays.
  // Check a pure ground-truth date: holiday discrete lands on its end (06-08),
  // children on 06-06..06-08 (the 06-05 child is the start day, after snapshot).
  const ledger = coord.projection().ledger;
  const holiday = ledger.filter((e) => e.source.startsWith("holiday-gw"));
  const discrete = holiday.find((e) => e.source === "holiday-gw")!;
  assert.equal(discrete.date, "2026-06-08");
  assert.equal(discrete.amount, 600);
  const children = holiday.filter((e) => e.source !== "holiday-gw");
  assert.deepEqual(children.map((e) => e.date).sort(), ["2026-06-05", "2026-06-06", "2026-06-07"]);
});

test("fold: rushing brings the discrete face to start; children do not move", () => {
  const coord = coordinator();
  coord.setRushed("holiday-gw", true);
  const ledger = coord.projection().ledger;
  assert.equal(ledger.find((e) => e.source === "holiday-gw")!.date, "2026-06-05");
  const children = ledger.filter((e) => e.source.startsWith("holiday-gw-"));
  assert.deepEqual(children.map((e) => e.date).sort(), ["2026-06-05", "2026-06-06", "2026-06-07"]);
});

test("fold: ledger attribution joins on the settled key (one naming system)", () => {
  const coord = coordinator();
  const keys = new Set(coord.settledEvents().map((e) => e.key));
  for (const entry of coord.projection().ledger) {
    if (entry.stream === "commitments") continue;
    assert.ok(keys.has(entry.source), `ledger source ${entry.source} not in the settled world`);
  }
});

// ── reconciliation (P_income → P_final) ─────────────────────────────────────

test("reconcile: the claim debits at start, measured at end; availableFor self-excludes", () => {
  const coord = coordinator();
  const before = coord.balanceAt(FAR).free_carats!;
  coord.commit("banner-kita", 1); // one spark of pity — the cost is the shipped pull-math's
  const cost = before - coord.balanceAt(FAR).free_carats!;
  assert.ok(cost > 0);
  // the debit lands on the banner's start (start-date attribution, debit source = claimed key)…
  const debit = coord.projection().ledger.find((e) => e.stream === "commitments" && e.source === "banner-kita")!;
  assert.equal(debit.date, "2026-06-12");
  assert.equal(debit.amount, -cost);
  // …and the banner's own availability never sees its own debit.
  assert.equal(coord.availableFor("banner-kita")!.free_carats, coord.balanceAt(cal("2026-06-22")).free_carats! + cost);
});

test("reconcile: seniority is earlier-by-start — a later banner sees the earlier claim", () => {
  const coord = coordinator();
  const before = coord.balanceAt(FAR).free_carats!;
  coord.commit("banner-kita", 1); // starts 06-12 — senior
  const kitaCost = before - coord.balanceAt(FAR).free_carats!;
  coord.commit("banner-sakura", 1); // starts 06-14 — junior
  const sakura = coord.availableFor("banner-sakura")!;
  const kita = coord.availableFor("banner-kita")!;
  // sakura measures at a later end (06-24 vs 06-22), so it gains the income that
  // lands in between (routine dailies) but is the senior claim's debit poorer.
  const incomeBetween = coord.balanceAt(cal("2026-06-24")).free_carats! - coord.balanceAt(cal("2026-06-22")).free_carats!;
  assert.equal(kita.free_carats! - sakura.free_carats!, kitaCost - incomeBetween);
});

test("reconcile: a claim against an unknown key throws (resolve-or-throw)", () => {
  const coord = coordinator();
  assert.throws(() => coord.commit("banner-ghost", 10), /unknown event/);
});

test("commit(key, 0) clears the claim", () => {
  const coord = coordinator();
  const base = coord.balanceAt(FAR).free_carats!;
  coord.commit("banner-kita", 100);
  coord.commit("banner-kita", 0);
  assert.equal(coord.balanceAt(FAR).free_carats, base);
  assert.equal(coord.availableFor("banner-kita"), undefined);
});

// ── the boundary (typed mutators, observe, toggles) ─────────────────────────

test("mutators notify once per write; reads never notify", () => {
  const coord = coordinator();
  let fired = 0;
  coord.subscribe(() => fired++);
  coord.setRushed("holiday-gw", true);
  coord.balanceAt(FAR);
  coord.settledEvents();
  coord.availableFor("banner-kita");
  assert.equal(fired, 1);
});

test("setEnabled is ephemeral whole-stream isolation: the contribution drops, the account state survives", () => {
  const coord = coordinator();
  const withRoutine = coord.balanceAt(FAR).free_carats!;
  coord.setEnabled("play.routine", false);
  const without = coord.balanceAt(FAR).free_carats!;
  assert.ok(without < withRoutine); // routine contributed
  assert.equal(coord.document().config, undefined); // nothing persisted by the toggle
  coord.setEnabled("play.routine", true);
  assert.equal(coord.balanceAt(FAR).free_carats, withRoutine);
});

test("subscriptions: the daily pack mints both families under the daily- fence", () => {
  const coord = coordinator();
  coord.setSubscriptions({ dailyPack: "2026-06-15" });
  const minted = coord.settledEvents().filter((e) => e.key.startsWith("daily-"));
  assert.ok(minted.some((e) => e.key.startsWith("daily-carats-"))); // the drip
  assert.ok(minted.some((e) => e.key.startsWith("daily-pack-"))); // the cycle grant
  assert.ok(minted.every((e) => !e.visible));
});
