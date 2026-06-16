import { test } from "node:test";
import assert from "node:assert/strict";

import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import { createSearchIndex } from "./entities.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

const EVENTS: EventsBundle = {
  events: [
    { type: "trainee", rushable: true, contents: ["trainee-teio-autumn"], image: "", start: "2026-06-08", end: "2026-06-15", predicted: false, key: "banner-trainee" },
    { type: "support", rushable: false, contents: ["support-teio-speed"], image: "", start: "2026-06-10", end: "2026-06-17", predicted: false, key: "banner-support" },
    { type: "support", rushable: false, contents: ["support-teio-speed-dupe"], image: "", start: "2026-06-12", end: "2026-06-19", predicted: false, key: "banner-support-dupe" },
    { type: "support", rushable: false, contents: ["support-teio-stamina"], image: "", start: "2026-05-10", end: "2026-05-17", predicted: false, key: "banner-past-support" },
    { type: "support", rushable: false, contents: ["support-ardan-speed", "support-ryan-stamina", "support-ramonu-wit"], image: "", start: "2026-06-25", end: "2026-07-02", predicted: false, key: "banner-mejiro" },
    { type: "trainee", rushable: true, contents: ["trainee-palmer-reindeer"], image: "", start: "2026-07-03", end: "2026-07-10", predicted: false, key: "banner-reindeer" },
  ],
};

const ACADEMY: Academy = {
  characters: {
    "char-teio": { name: "Tokai Teio", quote: null, icon: null, portrait: null },
    "char-ardan": { name: "Mejiro Ardan", quote: null, icon: null, portrait: null },
    "char-ryan": { name: "Mejiro Ryan", quote: null, icon: null, portrait: null },
    "char-ramonu": { name: "Mejiro Ramonu", quote: null, icon: null, portrait: null },
    "char-palmer": { name: "Mejiro Palmer", quote: null, icon: null, portrait: null },
  },
  supports: {
    "support-teio-speed": {
      character: "char-teio",
      display: "Tokai Teio",
      type: "speed",
      rarity: "ssr",
      title: "Dream Big",
      release: "2021-02-24",
      thumbnail: null,
      art: null,
      aliases: ["kaicho junior"],
    },
    "support-teio-speed-dupe": {
      character: "char-teio",
      display: "Tokai Teio",
      type: "speed",
      rarity: "ssr",
      title: "Same Label",
      release: "2021-02-24",
      thumbnail: null,
      art: null,
      aliases: [],
    },
    "support-teio-stamina": {
      character: "char-teio",
      display: "Tokai Teio",
      type: "stamina",
      rarity: "sr",
      title: "Old News",
      release: "2021-02-24",
      thumbnail: null,
      art: null,
      aliases: ["finished teio"],
    },
    "support-ardan-speed": {
      character: "char-ardan",
      display: "Mejiro Ardan",
      type: "speed",
      rarity: "ssr",
      title: "Plain Future Card",
      release: "2021-02-24",
      thumbnail: null,
      art: null,
      aliases: [],
    },
    "support-ryan-stamina": {
      character: "char-ryan",
      display: "Mejiro Ryan",
      type: "stamina",
      rarity: "sr",
      title: null,
      release: "2021-02-24",
      thumbnail: null,
      art: null,
      aliases: [],
    },
    "support-ramonu-wit": {
      character: "char-ramonu",
      display: "Mejiro Ramonu",
      type: "wit",
      rarity: "ssr",
      title: null,
      release: "2021-02-24",
      thumbnail: null,
      art: null,
      aliases: [],
    },
  },
  trainees: {
    "trainee-teio-autumn": {
      character: "char-teio",
      variant: "Autumn Festival",
      title: null,
      rarity: 3,
      release: "2021-10-01",
      thumbnail: null,
      portrait: null,
      aliases: ["festival teio"],
    },
    "trainee-palmer-reindeer": {
      character: "char-palmer",
      variant: "Warm-Hearted Reindeer",
      title: null,
      rarity: 3,
      release: "2021-10-01",
      thumbnail: null,
      portrait: null,
      aliases: [],
    },
  },
  courses: {},
  races: {},
  racetracks: {},
};

const search = () => createSearchIndex(createBundle(EVENTS, ACADEMY, TEST_CONFIG), "2026-06-05");

test("search finds active/future support and trainee banner atoms only", () => {
  const results = search()("toka");

  assert.deepEqual(
    results.map((result) => [result.kind, result.label, result.date, result.eventKey]),
    [
      ["trainee", "Tokai Teio (Autumn Festival)", "2026-06-08", "banner-trainee"],
      ["support", "SSR Tokai Teio (Speed)", "2026-06-10", "banner-support"],
    ],
  );
});

test("search matches aliases and all query words may narrow a family", () => {
  const index = search();

  assert.deepEqual(index("kaicho").map((result) => result.id), ["support-teio-speed"]);
  assert.deepEqual(index("festival").map((result) => result.id), ["trainee-teio-autumn"]);
  assert.deepEqual(index("tokai speed").map((result) => result.id), ["support-teio-speed"]);
});

test("search narrows by token prefix rather than substrings inside rarity labels", () => {
  const results = search()("mejiro r");

  assert.deepEqual(
    results.map((result) => result.label),
    ["SR Mejiro Ryan (Stamina)", "SSR Mejiro Ramonu (Wit)"],
  );
});

test("single-letter narrowing uses identity tokens, not costume/title tokens", () => {
  const labels = search()("mejiro r").map((result) => result.label);

  assert.equal(labels.includes("Mejiro Palmer (Warm-Hearted Reindeer)"), false);
  assert.deepEqual(search()("reindeer").map((result) => result.id), ["trainee-palmer-reindeer"]);
});

test("search folds duplicate labels onto their soonest actionable result", () => {
  assert.deepEqual(search()("tokai speed").map((result) => [result.id, result.date]), [["support-teio-speed", "2026-06-10"]]);
});

test("search culls finished banners", () => {
  const index = search();

  assert.deepEqual(index("finished teio"), []);
  assert.deepEqual(index("old news"), []);
});
