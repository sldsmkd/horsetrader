import { test } from "node:test";
import assert from "node:assert/strict";

import type { ConfigBundle } from "../bundle/config.gen.ts";
import type { EventsBundle } from "../bundle/events.gen.ts";
import { memoryStore } from "../persistence/storage.ts";
import { save } from "../persistence/index.ts";
import { CURRENT_VERSION } from "../persistence/document.ts";
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
      "strongest-team": { free_carats: 300, support_tickets: 1 },
    },
    reward_maps: {
      "champions-meeting": { "Group B 1st": { free_carats: 1000, support_tickets: 2 } },
      "story-1m": { tier1: { free_carats: 300 }, tier3: { free_carats: 900 } },
      "training-pass": { premium: { free_carats: 1000, paid_carats: 350 } },
      "team-trials": { "5:retention": { free_carats: 225 } },
      "club-rank": { "B+": { free_carats: 425 } },
      "league-of-heroes": { "Gold 4": { free_carats: 1300, support_tickets: 2 } },
      "strongest-team": { B: { free_carats: 400 }, A: { free_carats: 400, trainee_tickets: 1 } },
      masters: { "2": { free_carats: 3000, gold_crystal_shards: 5 } },
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
      // an event-gated mission (claimed by event.missions)…
      { type: "mission", title: "Grindy", start: "2026-06-04", end: "2026-06-14", predicted: false, key: "mission-grindy", rewards: { free_carats: 400 } },
      // …and an anniversary mission (separate type — universal, rides the complement).
      { type: "anniversarymission", title: "Anniv", start: "2026-06-04", end: "2026-06-14", predicted: false, key: "mission-anniv", rewards: { free_carats: 250 } },
      // graded claimers' records: a CM (no baked reward), a story with an era, a training pass.
      { type: "cm", name: "Taurus", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "cm-2026-06", rewards: {} },
      { type: "story", title: "Tale", era: "1m", start: "2026-06-09", end: "2026-06-19", predicted: false, key: "story-tale", rewards: {} },
      { type: "trainingpass", start: "2026-06-01", end: "2026-06-30", predicted: false, key: "training-pass-1", rewards: { free_carats: 120 } },
      { type: "leagueofheroes", name: "LoH", start: "2026-06-20", end: "2026-06-30", predicted: false, key: "loh-1", rewards: {} },
      { type: "strongestteam", name: "Strongest", start: "2026-06-21", end: "2026-06-30", predicted: false, key: "strongest-1", rewards: {} },
      { type: "masterschallenge", name: "Masters", banner: null, start: "2026-06-22", end: "2026-06-30", predicted: false, key: "masters-1", rewards: {} },
      // a banner — pulls on the face must never bank; commitments claim it.
      { type: "support", contents: [], image: "", start: "2026-06-12", end: "2026-06-22", predicted: false, key: "banner-kita", rewards: { pulls: 10 } },
      { type: "trainee", contents: [], image: "", start: "2026-06-14", end: "2026-06-24", predicted: false, key: "banner-sakura", rewards: { pulls: 10 } },
    ],
  } as unknown as EventsBundle;
}

const NOW = cal("2026-06-01");
const FAR = cal("2026-12-31");
const snapshot = { date: "2026-06-01", recordedAt: "2026-06-01T00:00:00.000Z", resources: { free_carats: 10000 } };
const play = {
  dailies: "on",
  weeklyLogin: "on",
  teamTrials: "rank50",
  anniversaryMissions: "on",
  holidays: "on",
  scenarioMissions: "on",
  traineeDebuts: "on",
  factorStudies: "off",
  racingCarnival: "off",
  showtime: "off",
  missions: "off",
  storyEvents: "tier1",
  championsMeeting: "off",
  shopTickets: "none",
  leagueOfHeroes: "gold4",
  strongestTeam: "B",
  legendRaces: "off",
  skillTests: "off",
  masters: "2",
} as const;

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
  assert.equal(registry.streams.length, 24);
});

// ── the settled world (the render source) ───────────────────────────────────

test("settled world: faces are resolved by the engine — CM stamped, story included, premium boosted", () => {
  const coord = coordinator();
  coord.setPlay("custom", { ...play, storyEvents: "tier1", championsMeeting: "groupBWinner" });
  coord.setSubscriptions({ trainingPass: true });

  const byKey = new Map(coord.settledEvents().map((e) => [e.key, e]));
  assert.deepEqual(byKey.get("cm-2026-06")!.rewards, { free_carats: 1000, support_tickets: 2 });
  assert.deepEqual(byKey.get("story-tale")!.rewards, { free_carats: 300 }); // era 1m × tier1 (baseline story participation)
  assert.deepEqual(byKey.get("training-pass-1")!.rewards, { free_carats: 120 + 1000, paid_carats: 350 });
  assert.deepEqual(byKey.get("loh-1")!.rewards, { free_carats: 1300, support_tickets: 2 });
  assert.deepEqual(byKey.get("strongest-1")!.rewards, { free_carats: 700, support_tickets: 1 });
  assert.deepEqual(byKey.get("masters-1")!.rewards, { free_carats: 3000, gold_crystal_shards: 5 });
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
  const coord = coordinator(); // default play style: missions off (sweetie default preset)
  coord.setPlay("custom", play);
  const keys = new Set(coord.settledEvents().map((e) => e.key));
  assert.ok(!keys.has("mission-grindy"));
  assert.ok(keys.has("mission-anniv")); // separate type — universal, never gated

  coord.setPlay("custom", { ...play, missions: "on" });
  assert.ok(new Set(coord.settledEvents().map((e) => e.key)).has("mission-grindy"));
});

test("grading is the face, not the gate: CM off stays on the lane, unpriced", () => {
  const coord = coordinator();
  coord.setPlay("custom", play);
  const cm = coord.settledEvents().find((e) => e.key === "cm-2026-06")!;
  assert.equal(cm.visible, true);
  assert.deepEqual(cm.rewards, {});
});

// ── the fold (money derivation, once) ───────────────────────────────────────

test("fold: pays faces at end, expansion children per-day, nothing on or before the snapshot", () => {
  const coord = coordinator();
  coord.setPlay("custom", { ...play, teamTrials: "rank40" });
  // rank40 has no row in the test config ⇒ team-trials inert; dailies pay.
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
  coord.commit("banner-kita", 1, false); // one spark of pity — the cost is the shipped pull-math's
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
  coord.commit("banner-kita", 1, false); // starts 06-12 — senior
  const kitaCost = before - coord.balanceAt(FAR).free_carats!;
  coord.commit("banner-sakura", 1, false); // starts 06-14 — junior
  const sakura = coord.availableFor("banner-sakura")!;
  const kita = coord.availableFor("banner-kita")!;
  // sakura measures at a later end (06-24 vs 06-22), so it gains the income that
  // lands in between (routine dailies) but is the senior claim's debit poorer.
  const incomeBetween = coord.balanceAt(cal("2026-06-24")).free_carats! - coord.balanceAt(cal("2026-06-22")).free_carats!;
  assert.equal(kita.free_carats! - sakura.free_carats!, kitaCost - incomeBetween);
});

test("reconcile: a claim against an unknown key throws (resolve-or-throw)", () => {
  const coord = coordinator();
  assert.throws(() => coord.commit("banner-ghost", 10, false), /unknown event/);
});

test("a committed trainee banner survives trainee-debuts being toggled off", () => {
  const coord = coordinator();
  coord.commit("banner-sakura", 5, false); // a trainee banner, committed while debuts are on
  // Toggling the debut-income lever off must NOT drop the banner (a pull target
  // with a live claim) from the lane — it would orphan the commitment.
  assert.doesNotThrow(() => coord.setPlay("custom", { ...play, traineeDebuts: "off" }));
  const byKey = new Map(coord.settledEvents().map((e) => [e.key, e]));
  assert.ok(byKey.has("banner-sakura")); // still present, just unpriced
});

test("commit(key, 0) clears the claim", () => {
  const coord = coordinator();
  const base = coord.balanceAt(FAR).free_carats!;
  coord.commit("banner-kita", 100, false);
  coord.commit("banner-kita", 0, false);
  assert.equal(coord.balanceAt(FAR).free_carats, base);
  assert.equal(coord.availableFor("banner-kita"), undefined);
});

test("commit stores the dict form only when use-paid is on; flat otherwise", () => {
  const coord = coordinator();
  coord.commit("banner-kita", 50, false);
  assert.equal(coord.document().commitments?.["banner-kita"], 50); // bare integer
  coord.commit("banner-kita", 50, true);
  assert.deepEqual(coord.document().commitments?.["banner-kita"], { number: 50, use_paid: true });
  // Re-committing without the flag drops back to the flat form (no stale dict).
  coord.commit("banner-kita", 60, false);
  assert.equal(coord.document().commitments?.["banner-kita"], 60);
});

test("setNote normalises on the way in (trim + cap) and clears on blank", () => {
  const coord = coordinator();
  coord.setNote("trainee-gold-ship", "  won't leave the gate  ");
  assert.equal(coord.document().notes?.["trainee-gold-ship"], "won't leave the gate"); // trimmed
  const long = "x".repeat(400);
  coord.setNote("support-tazuna", long);
  assert.equal(coord.document().notes?.["support-tazuna"].length, 140); // capped at a cleat
  // Excess whitespace is collapsed so a cleat can't be all blank lines (DoS the
  // surface): runs of spaces → one, at most one blank line between paragraphs.
  coord.setNote("trainee-gold-ship", "a" + "\n".repeat(240) + "b");
  assert.equal(coord.document().notes?.["trainee-gold-ship"], "a\n\nb");
  coord.setNote("trainee-gold-ship", "lots     of   space");
  assert.equal(coord.document().notes?.["trainee-gold-ship"], "lots of space");
  // A blank/whitespace note clears the key (sparse, never stored empty).
  coord.setNote("trainee-gold-ship", "   \n\n\n  ");
  assert.equal(coord.document().notes?.["trainee-gold-ship"], undefined);
});

test("setUsername allow-lists, grapheme-caps, and trims the trainer name", () => {
  const coord = coordinator();
  coord.setUsername("  Xelene  ");
  assert.equal(coord.username(), "Xelene"); // trimmed at commit
  coord.setUsername("x".repeat(40));
  assert.equal(coord.username().length, 24); // capped at TRAINER_NAME_MAX
  // A NUL control char and an RTL-override are outside the allow-list → dropped.
  coord.setUsername("Foo" + String.fromCharCode(0, 0x202e) + "Bar");
  assert.equal(coord.username(), "FooBar");
  coord.setUsername("   ");
  assert.equal(coord.username(), ""); // blank clears
});

test("saveSnapshot clamps each resource to its width (non-negative int, per-resource cap)", () => {
  const coord = coordinator();
  coord.saveSnapshot({
    date: "2026-06-21",
    recordedAt: "2026-06-21T00:00:00.000Z",
    resources: {
      free_carats: 12_345_678, // over int[7]
      trainee_tickets: 5000, // over int[3]
      rainbow_crystal: 500, // over int[2]
      paid_carats: -50, // negative
      support_tickets: 3.9, // fractional
    },
  });
  const r = coord.document().snapshot!.resources;
  assert.equal(r.free_carats, 9_999_999);
  assert.equal(r.trainee_tickets, 999);
  assert.equal(r.rainbow_crystal, 99);
  assert.equal(r.paid_carats, 0);
  assert.equal(r.support_tickets, 3); // floored, not rounded
});

// ── the boundary (typed mutators, observe, toggles) ─────────────────────────

test("a legacy flat v1 save is durably migrated to the envelope on load (not deferred)", () => {
  const store = memoryStore();
  store.write(
    "horsetrader.plan",
    JSON.stringify({ version: 1, config: { identity: { trainerName: "Xelene", trainerId: "123456789012", oshiId: "char-orfevre" } } }),
  );
  // Construct + immediately discard — loading alone must rewrite the store.
  createCoordinator({ bundle: bundle(), config: config(), now: NOW, store });
  const written = JSON.parse(store.read("horsetrader.plan") as string);
  assert.equal(written.remote.version, CURRENT_VERSION); // migrated all the way to current
  // The display name now syncs — it stays in the remote plan; only the retired
  // Trainer ID is stripped, and nothing lands in local.
  assert.equal(written.remote.config.identity.trainerName, "Xelene");
  assert.equal(JSON.stringify(written.remote).includes("trainerId"), false);
  assert.equal("username" in written.local, false);
  assert.equal(written.remote.config.identity.oshiId, "char-orfevre");
});

test("sync meta: mutations set dirty, markSynced clears + records the rev", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), config: config(), now: NOW, store });
  assert.deepEqual(coord.syncMeta(), { etag: null, dirty: false });
  coord.commit("banner-kita", 100, false); // any plan mutation diverges from the cloud
  assert.equal(coord.syncMeta().dirty, true);
  coord.markSynced('"abc123"');
  assert.deepEqual(coord.syncMeta(), { etag: '"abc123"', dirty: false });
  // dirty + etag persist across reload (local.sync round-trips).
  coord.commit("banner-kita", 50, false);
  assert.deepEqual(createCoordinator({ bundle: bundle(), config: config(), now: NOW, store }).syncMeta(), { etag: '"abc123"', dirty: true });
});

test("never-synced plan loads DIRTY iff it holds content — so first connect can push it up", () => {
  // A pre-Unity / never-synced save has no `local.sync`; a populated one must read dirty
  // so Sync is enabled and a populated browser can seed an empty cloud (the reported bug:
  // the empty browser couldn't pull until the populated one was edited to flip dirty).
  const populated = memoryStore();
  save({ local: {}, remote: { version: CURRENT_VERSION, commitments: { "banner-kita": 50 } } }, populated);
  assert.equal(createCoordinator({ bundle: bundle(), config: config(), now: NOW, store: populated }).syncMeta().dirty, true);

  // An empty never-synced plan stays clean — a blank browser offers no spurious push.
  const empty = memoryStore();
  save({ local: {}, remote: { version: CURRENT_VERSION } }, empty);
  assert.deepEqual(createCoordinator({ bundle: bundle(), config: config(), now: NOW, store: empty }).syncMeta(), {
    etag: null,
    dirty: false,
  });
});

test("adoptRemote swaps the plan + records the rev, bringing the cloud's trainer name across", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), config: config(), now: NOW, store });
  coord.setUsername("Local");
  coord.commit("banner-kita", 100, false);
  assert.equal(Object.keys(coord.document().commitments ?? {}).length, 1);
  // Adopt a cloud plan that carries its own (synced) trainer name.
  coord.adoptRemote({ version: 2, config: { identity: { trainerName: "Cloud" } } }, '"cloud-rev"');
  assert.deepEqual(coord.document().commitments ?? {}, {});
  assert.deepEqual(coord.syncMeta(), { etag: '"cloud-rev"', dirty: false });
  assert.equal(coord.username(), "Cloud"); // the name rode in with the plan — the "sync worked" signal
});

test("the trainer name lives in the synced plan: rides in document(), persists, diverges the rev", () => {
  const store = memoryStore();
  const coord = createCoordinator({ bundle: bundle(), config: config(), now: NOW, store });
  coord.setUsername("Xelene");
  assert.equal(coord.username(), "Xelene");
  // It lives IN the syncable plan (document() is the `remote` half) so it syncs,
  // and setting it diverges the cloud rev like any plan edit.
  assert.equal(JSON.stringify(coord.document()).includes("Xelene"), true);
  assert.equal(coord.syncMeta().dirty, true);
  // Survives a fresh coordinator over the same store.
  const reloaded = createCoordinator({ bundle: bundle(), config: config(), now: NOW, store });
  assert.equal(reloaded.username(), "Xelene");
  // Empty clears it.
  reloaded.setUsername("");
  assert.equal(reloaded.username(), "");
});

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
  const withDailies = coord.balanceAt(FAR).free_carats!;
  coord.setEnabled("play.dailies", false);
  const without = coord.balanceAt(FAR).free_carats!;
  assert.ok(without < withDailies); // dailies contributed
  assert.equal(coord.document().config, undefined); // nothing persisted by the toggle
  coord.setEnabled("play.dailies", true);
  assert.equal(coord.balanceAt(FAR).free_carats, withDailies);
});

test("subscriptions: the daily pack mints both families under the daily- fence", () => {
  const coord = coordinator();
  coord.setSubscriptions({ dailyPack: "2026-06-15" });
  const minted = coord.settledEvents().filter((e) => e.key.startsWith("daily-"));
  assert.ok(minted.some((e) => e.key.startsWith("daily-carats-"))); // the drip
  assert.ok(minted.some((e) => e.key.startsWith("daily-pack-"))); // the cycle grant
  assert.ok(minted.every((e) => !e.visible));
});
