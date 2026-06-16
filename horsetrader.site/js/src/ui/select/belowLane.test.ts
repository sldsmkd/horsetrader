import { test } from "node:test";
import assert from "node:assert/strict";

import { belowLaneCards } from "./belowLane.ts";
import { createAxis } from "../axis.ts";
import { settle } from "../../core/engine/index.ts";
import type { SettledEvent, StreamCtx } from "../../core/engine/index.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import { cal } from "../../core/projection/dates.ts";

const EVENTS: EventsBundle = {
  events: [
    { type: "trainee", rushable: true, contents: [], image: "/i.webp", start: "2026-06-10", end: "2026-06-15", predicted: false, key: "banner-1", rewards: { free_carats: 720 } },
    { type: "story", rushable: true, title: "A Story", contents: [], image: null, banner: null, art: null, era: "1m", start: "2026-06-14", end: "2026-06-20", predicted: true, key: "story-1" },
    { type: "holiday", name: "Golden Week", start: "2026-06-25", end: "2026-06-25", predicted: false, key: "holiday-1", rewards: { free_carats: 50 } },
    { type: "cm", name: "Summer CM", start: "2026-06-27", end: "2026-07-01", predicted: false, key: "cm-1", rewards: { free_carats: 1000 } },
    { type: "scenario", title: null, image: null, art: null, start: "2026-07-20", end: "2026-08-01", predicted: false, key: "sce-1", rewards: { free_carats: 300 } },
    // A reward-less below-lane event (a PvP CM you didn't enter): no `rewards` at
    // all, yet it must still get a card — visibility is the appearance, not a payout.
    { type: "cm", name: "Autumn CM", start: "2026-08-10", end: "2026-08-14", predicted: false, key: "cm-2" },
  ],
};

const NOW = cal("2026-06-08");
const AXIS = createAxis({ origin: cal("2026-06-01"), pxPerDay: 10 });

/** Settle baked records through the real settlement rule — the same faces and
 *  minted cadence children the engine's settled world carries. The selector only
 *  reads `timeZone`/`after` through `settle`, so a minimal ctx suffices. */
function settled(events: EventsBundle, after = cal("2026-01-01")): SettledEvent[] {
  const ctx = { timeZone: "UTC", after } as StreamCtx;
  return events.events.flatMap((record) => settle(record, ctx));
}

test("below-lane cards: below-lane events only, resolved + positioned, sorted by date", () => {
  const cards = belowLaneCards(settled(EVENTS), AXIS, NOW);

  // The trainee banner (above-lane) is excluded; everything else gets a card.
  assert.deepEqual(cards.map((c) => c.key), ["story-1", "holiday-1", "cm-1", "sce-1", "cm-2"]);
  assert.deepEqual(cards.map((c) => c.kind), ["story", "holiday", "cm", "scenario", "cm"]);
});

test("a reward-less below-lane event still gets a card, with an empty reward", () => {
  const cards = belowLaneCards(settled(EVENTS), AXIS, NOW);
  const card = cards.find((c) => c.key === "cm-2");

  assert.ok(card, "the reward-less CM is on the lane — existence is the appearance, not a payout");
  assert.equal(card!.label, "Autumn CM");
  assert.deepEqual(card!.reward, {}); // no payout, but present
});

test("an invisible scenario launch is left to the scenario wallpaper", () => {
  const events: EventsBundle = {
    events: [
      {
        type: "scenario",
        title: "Project L'Arc",
        image: "/img/scenarios/scenario-06_thumb.webp",
        art: "/img/scenarios/scenario-06.webp",
        start: "2027-03-06",
        end: "2027-03-06",
        predicted: true,
        key: "scenario-06",
        visible: false,
      } as EventsBundle["events"][number],
    ],
  };

  const cards = belowLaneCards(settled(events), AXIS, NOW);
  assert.deepEqual(cards, []);
});

test("visibility is opt-out: an explicit `visible: false` hides the card, absence shows it", () => {
  // The flag isn't in the generated bundle type yet, so set it structurally.
  const events: EventsBundle = {
    events: [
      { type: "cm", name: "Hidden CM", start: "2026-09-01", end: "2026-09-05", predicted: false, key: "cm-hidden", visible: false } as EventsBundle["events"][number],
      { type: "cm", name: "Shown CM", start: "2026-09-10", end: "2026-09-15", predicted: false, key: "cm-shown" },
    ],
  };
  const cards = belowLaneCards(settled(events), AXIS, NOW);

  assert.deepEqual(cards.map((c) => c.key), ["cm-shown"]); // only the visible one
});

test("each card resolves its label (name/title, falling back to key) and predicted flag", () => {
  const cards = belowLaneCards(settled(EVENTS), AXIS, NOW);
  const byKey = new Map(cards.map((c) => [c.key, c]));

  assert.equal(byKey.get("cm-1")!.label, "Summer CM");
  assert.equal(byKey.get("story-1")!.label, "A Story");
  assert.equal(byKey.get("story-1")!.banner, null);
  assert.equal(byKey.get("holiday-1")!.label, "Golden Week"); // carries a name
  assert.equal(byKey.get("sce-1")!.label, "sce-1"); // title null → the key
  assert.equal(byKey.get("story-1")!.predicted, true);
  assert.equal(byKey.get("cm-1")!.predicted, false);
  assert.equal(byKey.get("story-1")!.past, false);
  assert.equal(byKey.get("cm-1")!.past, false);
});

test("story cards carry baked banner art when present", () => {
  const events: EventsBundle = {
    events: [
      {
        type: "story",
        title: "Banner Story",
        contents: [],
        image: null,
        banner: "/img/stories/story-015-banner.webp",
        art: null,
        era: "1m",
        start: "2026-06-14",
        end: "2026-06-20",
        predicted: false,
        key: "story-015",
      },
    ],
  };

  const cards = belowLaneCards(settled(events), AXIS, NOW);
  assert.equal(cards[0]!.banner, "/img/stories/story-015-banner.webp");
});

test("holiday cards carry baked banner art when present", () => {
  const events: EventsBundle = {
    events: [
      {
        type: "holiday",
        name: "Gyaru Week",
        banner: "/img/holidays/holiday-golden-week-2023-banner.webp",
        start: "2027-01-07",
        end: "2027-01-21",
        predicted: true,
        key: "holiday-golden-week-2023",
      },
    ],
  };

  const cards = belowLaneCards(settled(events), AXIS, NOW);
  assert.equal(cards[0]!.banner, "/img/holidays/holiday-golden-week-2023-banner.webp");
});

test("skill test cards carry baked misc banner art", () => {
  const events: EventsBundle = {
    events: [
      {
        type: "skilltest",
        name: "Trainer Skills Test",
        banner: "/img/misc/trainers-skill-test.webp",
        start: "2026-08-01",
        end: "2026-08-10",
        predicted: false,
        key: "skilltest-001",
        rewards: { free_carats: 1500 },
      },
    ],
  };

  const cards = belowLaneCards(settled(events), AXIS, NOW);
  assert.equal(cards[0]!.banner, "/img/misc/trainers-skill-test.webp");
});

test("factor studies cards carry baked misc banner art", () => {
  const events: EventsBundle = {
    events: [
      {
        type: "factorstudies",
        name: "Factor Studies of Agnes Tachyon",
        banner: "/img/misc/event-factors.webp",
        start: "2026-08-01",
        end: "2026-08-10",
        predicted: false,
        key: "factorstudies-001",
        rewards: { free_carats: 500 },
      },
    ],
  };

  const cards = belowLaneCards(settled(events), AXIS, NOW);
  assert.equal(cards[0]!.banner, "/img/misc/event-factors.webp");
});

test("showtime cards carry baked misc banner art", () => {
  const events: EventsBundle = {
    events: [
      {
        type: "showtime",
        name: "Fuji Kiseki's Showtime Event",
        banner: "/img/misc/showtime.webp",
        start: "2026-08-01",
        end: "2026-08-10",
        predicted: false,
        key: "showtime-001",
        rewards: { free_carats: 500 },
      },
    ],
  };

  const cards = belowLaneCards(settled(events), AXIS, NOW);
  assert.equal(cards[0]!.banner, "/img/misc/showtime.webp");
});

test("racing carnival cards carry baked misc banner art", () => {
  const events: EventsBundle = {
    events: [
      {
        type: "racingcarnival",
        name: "Racing Carnival",
        banner: "/img/misc/racing-carnival.webp",
        start: "2026-08-01",
        end: "2026-08-10",
        predicted: false,
        key: "racingcarnival-001",
        rewards: { free_carats: 500 },
      },
    ],
  };

  const cards = belowLaneCards(settled(events), AXIS, NOW);
  assert.equal(cards[0]!.banner, "/img/misc/racing-carnival.webp");
});

test("strongest team cards carry baked misc banner art", () => {
  const events: EventsBundle = {
    events: [
      {
        type: "strongestteam",
        name: "Aim! Strongest Team",
        banner: "/img/misc/strongest-team.webp",
        start: "2026-08-01",
        end: "2026-08-10",
        predicted: false,
        key: "strongestteam-001",
      },
    ],
  };

  const cards = belowLaneCards(settled(events), AXIS, NOW);
  assert.equal(cards[0]!.banner, "/img/misc/strongest-team.webp");
});

test("past cards are marked after their end date", () => {
  const cards = belowLaneCards(settled(EVENTS), AXIS, cal("2026-07-02"));
  const byKey = new Map(cards.map((c) => [c.key, c]));

  assert.equal(byKey.get("story-1")!.past, true);
  assert.equal(byKey.get("cm-1")!.past, true);
  assert.equal(byKey.get("sce-1")!.past, false);
});

test("x is true-to-date off the axis (arrival date = start) and reward is the resolved face", () => {
  const cards = belowLaneCards(settled(EVENTS), AXIS, NOW);
  const byKey = new Map(cards.map((c) => [c.key, c]));

  assert.equal(byKey.get("story-1")!.date, "2026-06-14"); // start, not end
  assert.equal(byKey.get("story-1")!.x, 130); // 13 days × 10px
  assert.equal(byKey.get("cm-1")!.x, 260); // 2026-06-27 → 26 days
  assert.equal(byKey.get("sce-1")!.x, 490); // 2026-07-20 → 49 days

  // The card carries its own face, not the day's subtotal.
  assert.deepEqual(byKey.get("cm-1")!.reward, { free_carats: 1000 });
  assert.deepEqual(byKey.get("holiday-1")!.reward, { free_carats: 50 });
});

test("an anniversary mission's card combines its flat face and its minted daily sequence", () => {
  // The flat reward is the parent's face; the per-day sequence becomes minted
  // `visible:false` children under the parent key (rules/settle.ts). The card
  // folds the children back so the whole grant reads as one signal.
  const events: EventsBundle = {
    events: [
      {
        type: "anniversarymission",
        name: "1st Anniversary Missions Part 1",
        image: null,
        anniversary: "anniversary-1_0",
        part: 1,
        start: "2026-07-01",
        end: "2026-07-10",
        predicted: false,
        key: "anni-mission-1",
        rewards: { trainee_tickets: 3, free_carats: 500, sequence: { type: "free_carats", sequence: [150, 150] } },
      } as EventsBundle["events"][number],
    ],
  };
  const cards = belowLaneCards(settled(events), AXIS, NOW);

  assert.deepEqual(cards.map((c) => c.kind), ["anniversarymission"]);
  assert.equal(cards[0]!.label, "1st Anniv. P1");
  assert.equal(cards[0]!.fullLabel, "1st Anniversary Missions Part 1");
  // free_carats: 500 (flat) + 150 + 150 (sequence); trainee_tickets: 3 (flat).
  assert.deepEqual(cards[0]!.reward, { trainee_tickets: 3, free_carats: 800 });
});

test("mission-shaped cards use compact display labels without losing the source label", () => {
  const events: EventsBundle = {
    events: [
      {
        type: "mission",
        name: "Spring G1 Celebration Missions, Part 1: Takamatsunomiya Kinen",
        image: "/img/missions/mission-g1.webp",
        start: "2026-07-01",
        end: "2026-07-10",
        predicted: false,
        key: "mission-g1",
      },
      {
        type: "mission",
        name: "G1 Celebration Missions Part 1 February Stakes",
        image: "/img/missions/mission-g1-plain.webp",
        start: "2026-07-02",
        end: "2026-07-10",
        predicted: false,
        key: "mission-g1-plain",
      },
      {
        type: "mission",
        name: "Spring G1 Celebration Missions, Part 1: Oka Sho",
        image: "/img/missions/mission-oka.webp",
        start: "2026-07-03",
        end: "2026-07-10",
        predicted: false,
        key: "mission-oka",
      },
      {
        type: "mission",
        name: "Spring G1 Celebration Missions, Part 1: Osaka Hai",
        image: "/img/missions/mission-osaka.webp",
        start: "2026-07-04",
        end: "2026-07-10",
        predicted: false,
        key: "mission-osaka",
      },
      {
        type: "mission",
        name: "Fall G1 Celebration Missions, Part 2: Queen Elizabeth II Cup",
        image: "/img/missions/mission-qeii.webp",
        start: "2026-07-05",
        end: "2026-07-10",
        predicted: false,
        key: "mission-qeii",
      },
      {
        type: "mission",
        name: "Fall G1 Celebration Missions, Part 1: Mile Championship Nambu Hai",
        image: "/img/missions/mission-mile-cs.webp",
        start: "2026-07-06",
        end: "2026-07-10",
        predicted: false,
        key: "mission-mile-cs",
      },
      {
        type: "mission",
        name: "Fall G1 Celebration Missions, Part 1: Sprinters Stakes",
        image: "/img/missions/mission-sprinters.webp",
        start: "2026-07-07",
        end: "2026-07-10",
        predicted: false,
        key: "mission-sprinters",
      },
      {
        type: "mission",
        name: "Golshi Week Special Missions",
        image: "/img/missions/mission-golshi.webp",
        start: "2026-07-08",
        end: "2026-07-10",
        predicted: false,
        key: "mission-golshi",
      },
      {
        type: "scenariomission",
        name: "Run, Mecha Umamusume! Missions",
        image: "/img/missions/mission-scenario.webp",
        scenario: "scenario-09",
        start: "2026-07-09",
        end: "2026-07-10",
        predicted: false,
        key: "mission-scenario",
      },
    ],
  };

  const cards = belowLaneCards(settled(events), AXIS, NOW);
  const labels = new Map(cards.map((c) => [c.key, [c.label, c.fullLabel]]));

  assert.deepEqual(labels.get("mission-g1"), [
    "Takamatsunomiya Kinen",
    "Spring G1 Celebration Missions, Part 1: Takamatsunomiya Kinen",
  ]);
  assert.deepEqual(labels.get("mission-g1-plain"), [
    "February S.",
    "G1 Celebration Missions Part 1 February Stakes",
  ]);
  assert.deepEqual(labels.get("mission-oka"), [
    "Oka Sho",
    "Spring G1 Celebration Missions, Part 1: Oka Sho",
  ]);
  assert.deepEqual(labels.get("mission-osaka"), [
    "Osaka Hai",
    "Spring G1 Celebration Missions, Part 1: Osaka Hai",
  ]);
  assert.deepEqual(labels.get("mission-qeii"), [
    "QEII Cup",
    "Fall G1 Celebration Missions, Part 2: Queen Elizabeth II Cup",
  ]);
  assert.deepEqual(labels.get("mission-mile-cs"), [
    "Mile Ch. Nambu Hai",
    "Fall G1 Celebration Missions, Part 1: Mile Championship Nambu Hai",
  ]);
  assert.deepEqual(labels.get("mission-sprinters"), [
    "Sprinters S.",
    "Fall G1 Celebration Missions, Part 1: Sprinters Stakes",
  ]);
  assert.deepEqual(labels.get("mission-golshi"), [
    "Golshi Week Special",
    "Golshi Week Special Missions",
  ]);
  assert.deepEqual(labels.get("mission-scenario"), [
    "Run, Mecha Umamusume!",
    "Run, Mecha Umamusume! Missions",
  ]);
});

test("presence is the stream's call: a gated-off mission is absent from the input, so no card", () => {
  // Under the engine, the event.missions stream gates PRESENCE — toggled off, its
  // events never reach the settled world, so the cards leave with the income.
  // (The old `hiddenKinds` re-derivation in the shell is gone.)
  const events: EventsBundle = {
    events: [
      {
        type: "mission",
        name: "G1 Mission",
        image: "/img/missions/mission-1.webp",
        start: "2026-07-01",
        end: "2026-07-10",
        predicted: false,
        key: "mission-1",
        rewards: { free_carats: 150 },
      },
      { type: "cm", name: "Summer CM", start: "2026-07-05", end: "2026-07-08", predicted: false, key: "cm-1", rewards: { free_carats: 1000 } },
    ],
  };

  // Missions ON: both events are in the settled world — both carded.
  const on = belowLaneCards(settled(events), AXIS, NOW);
  assert.deepEqual(on.map((c) => c.key), ["mission-1", "cm-1"]);
  assert.deepEqual(on.find((c) => c.key === "mission-1")!.reward, { free_carats: 150 });
  assert.equal(on.find((c) => c.key === "mission-1")!.image, "/img/missions/mission-1.webp");

  // Missions OFF: the stream contributed nothing — the mission card is gone.
  const off = belowLaneCards(settled(events).filter((ev) => ev.type !== "mission"), AXIS, NOW);
  assert.deepEqual(off.map((c) => c.key), ["cm-1"]);
});

test("a graded face (story) reads straight off the settled event — no second lookup", () => {
  // Stories carry no baked rewards of their own; the owning stream stamps the
  // play-graded reward-map row onto the face at settle time. The card just reads it.
  const record = { type: "story", title: "A Story", contents: [], image: null, banner: null, art: null, era: "1m", start: "2026-07-01", end: "2026-07-10", predicted: false, key: "story-1", rushable: true } as EventsBundle["events"][number];
  const ctx = { timeZone: "UTC", after: cal("2026-01-01") } as StreamCtx;
  const world = settle(record, ctx, { free_carats: 690, gold_crystal_shards: 1 });

  const cards = belowLaneCards(world, AXIS, NOW);
  assert.deepEqual(cards.find((c) => c.key === "story-1")!.reward, { free_carats: 690, gold_crystal_shards: 1 });
});
