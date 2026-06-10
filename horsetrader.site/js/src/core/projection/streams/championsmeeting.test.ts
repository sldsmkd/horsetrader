import { test } from "node:test";
import assert from "node:assert/strict";

import { applyChampionsMeetingRewards, championsMeetingReward } from "./championsmeeting.ts";
import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle, CMRecord, TraineeBannerRecord } from "../../bundle/events.gen.ts";

function config(over: Partial<ConfigBundle["reward_maps"]["champions-meeting"]> = {}): ConfigBundle {
  return {
    reward_structures: {},
    reward_maps: {
      "champions-meeting": {
        Champion: { free_carats: 3300, trainee_tickets: 5, support_tickets: 5 },
        Second: { free_carats: 2400, trainee_tickets: 4, support_tickets: 4 },
        "Group B 1st": { free_carats: 1800, trainee_tickets: 3, support_tickets: 3 },
        "Group B 3rd": { free_carats: 1000, trainee_tickets: 1, support_tickets: 1 },
        ...over,
      },
    },
    gacha: { spark_threshold: 200, carats_per_pull: 150, paid_daily_pull: 50, rarity_rates: {}, featured_rates: {} },
  };
}

function cm(key: string, rewards?: CMRecord["rewards"]): CMRecord {
  const base: CMRecord = { type: "cm", name: null, start: "2026-02-08", end: "2026-02-15", predicted: false, key };
  return rewards ? { ...base, rewards } : base;
}

test("championsMeetingReward selects the mapped rank row from the baked table", () => {
  assert.deepEqual(championsMeetingReward(config(), "groupAChampion"), {
    free_carats: 3300,
    trainee_tickets: 5,
    support_tickets: 5,
  });
  assert.equal(championsMeetingReward(config(), "groupBContender")?.free_carats, 1000);
  assert.equal(championsMeetingReward(config(), "groupBWinner")?.free_carats, 1800);
  assert.equal(championsMeetingReward(config(), "groupARunnerUp")?.free_carats, 2400);
});

test("championsMeetingReward is null when there is no reward to stamp", () => {
  assert.equal(championsMeetingReward(config(), "skip"), null); // a legitimate no-reward choice
  assert.equal(championsMeetingReward(config(), "rank99"), null); // unknown level
  const missing = config();
  delete missing.reward_maps["champions-meeting"]["Champion"];
  assert.equal(championsMeetingReward(missing, "groupAChampion"), null); // bake missing the row
});

test("applyChampionsMeetingRewards stamps the rank reward onto every CM record", () => {
  const bundle: EventsBundle = { events: [cm("cm-001"), cm("cm-002")] };
  const out = applyChampionsMeetingRewards(bundle, config(), "groupAChampion");
  for (const ev of out.events) {
    assert.deepEqual(ev.rewards, { free_carats: 3300, trainee_tickets: 5, support_tickets: 5 });
  }
});

test("only CM records are touched; other event kinds pass through unchanged", () => {
  const banner: TraineeBannerRecord = {
    type: "trainee",
    contents: ["x"],
    image: "i",
    start: "2026-02-01",
    end: "2026-02-10",
    predicted: false,
    key: "tr-001",
    rewards: { pulls: 10 },
  };
  const out = applyChampionsMeetingRewards({ events: [cm("cm-001"), banner] }, config(), "groupBWinner");
  assert.equal(out.events[0].rewards?.["free_carats"], 1800);
  assert.equal(out.events[1], banner); // same reference — untouched
});

test("a CM's existing reward keys are preserved; the rank reward inserts and replaces on conflict", () => {
  // baked free_carats 100 (replaced by the rank's 1800), baked `pulls` kept (inserted-around).
  const bundle: EventsBundle = { events: [cm("cm-001", { free_carats: 100, pulls: 10 })] };
  const out = applyChampionsMeetingRewards(bundle, config(), "groupBWinner");
  assert.deepEqual(out.events[0].rewards, { free_carats: 1800, trainee_tickets: 3, support_tickets: 3, pulls: 10 });
});

test("skip / unknown / missing-row passes the bundle through by reference (nothing to stamp)", () => {
  const bundle: EventsBundle = { events: [cm("cm-001")] };
  assert.equal(applyChampionsMeetingRewards(bundle, config(), "skip"), bundle);
  assert.equal(applyChampionsMeetingRewards(bundle, config(), "rank99"), bundle);
});

test("non-mutating: the baked records are left untouched", () => {
  const original = cm("cm-001");
  applyChampionsMeetingRewards({ events: [original] }, config(), "groupAChampion");
  assert.equal(original.rewards, undefined); // the source record never gained rewards
});
