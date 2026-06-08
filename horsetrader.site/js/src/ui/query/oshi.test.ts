import { test } from "node:test";
import assert from "node:assert/strict";

import { createBundle } from "../bundle/access.ts";
import { createOshiIndex, DEFAULT_OSHI_ID, searchOshis, selectedOshiOption, starterOshis } from "./oshi.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

const EVENTS: EventsBundle = { events: [] };

const ACADEMY: Academy = {
  characters: {
    "char-admire-groove": { name: "Admire Groove", quote: null, icon: "/admire.webp", portrait: "/admire-portrait.webp" },
    "char-haru-urara": { name: "Haru Urara", quote: null, icon: "/urara.webp", portrait: "/urara-portrait.webp" },
    "char-maruzensky": { name: "Maruzensky", quote: null, icon: "/maruzensky.webp", portrait: "/maruzensky-portrait.webp" },
    "char-teio": { name: "Tokai Teio", quote: null, icon: "/teio.webp", portrait: "/teio-portrait.webp" },
    "char-tazuna": { name: "Hayakawa Tazuna", quote: null, icon: "/tazuna.webp", portrait: null },
    "char-palmer": { name: "Mejiro Palmer", quote: null, icon: "/palmer.webp", portrait: null },
  },
  supports: {
    "support-tazuna": {
      character: "char-tazuna",
      display: "Hayakawa Tazuna",
      type: "friend",
      rarity: "ssr",
      title: null,
      release: "2021-02-24",
      thumbnail: null,
      art: null,
      aliases: [],
    },
  },
  trainees: {
    "trainee-admire-groove": {
      character: "char-admire-groove",
      variant: null,
      rarity: 3,
      release: "2021-02-24",
      thumbnail: null,
      portrait: null,
      aliases: [],
    },
    "trainee-haru-urara": {
      character: "char-haru-urara",
      variant: null,
      rarity: 1,
      release: "2021-02-24",
      thumbnail: null,
      portrait: null,
      aliases: [],
    },
    "trainee-maruzensky": {
      character: "char-maruzensky",
      variant: null,
      rarity: 3,
      release: "2021-02-24",
      thumbnail: null,
      portrait: null,
      aliases: [],
    },
    "trainee-teio-autumn": {
      character: "char-teio",
      variant: "Autumn Festival",
      rarity: 3,
      release: "2021-10-01",
      thumbnail: null,
      portrait: null,
      aliases: [],
    },
    "trainee-palmer-reindeer": {
      character: "char-palmer",
      variant: "Warm-Hearted Reindeer",
      rarity: 3,
      release: "2021-12-01",
      thumbnail: null,
      portrait: null,
      aliases: [],
    },
  },
};

test("starter oshi slot 0 is the player-selection default", () => {
  assert.equal(DEFAULT_OSHI_ID, "char-haru-urara");
  assert.deepEqual(starterOshis(selectedOshiOption(createBundle(EVENTS, ACADEMY), null))[0], {
    id: "char-haru-urara",
    name: "Haru Urara",
    icon: "/urara.webp",
    portrait: "/urara-portrait.webp",
  });
});

test("starter oshi slot 0 mirrors the persisted selected character", () => {
  const selected = selectedOshiOption(createBundle(EVENTS, ACADEMY), "char-admire-groove");

  assert.deepEqual(selected, {
    id: "char-admire-groove",
    name: "Admire Groove",
    icon: "/admire.webp",
    portrait: "/admire-portrait.webp",
  });
  assert.deepEqual(starterOshis(selected)[0], selected);
});

test("starter oshi list dedupes selected seed characters and pads with overflow", () => {
  const selected = starterOshis(selectedOshiOption(createBundle(EVENTS, ACADEMY), "char-maruzensky"));

  assert.equal(selected.length, 12);
  assert.equal(selected.filter((oshi) => oshi.id === "char-maruzensky").length, 1);
  assert.deepEqual(selected.map((oshi) => oshi.id).slice(-2), ["char-gold-ship", "char-sakura-bakushin-o"]);
});

test("search choices keep selected in slot 0 without default backfill", () => {
  const selected = selectedOshiOption(createBundle(EVENTS, ACADEMY), "char-maruzensky");
  const matches = [
    { id: "char-admire-groove", name: "Admire Groove", icon: "/admire.webp", portrait: "/admire-portrait.webp" },
    selected,
    { id: "char-teio", name: "Tokai Teio", icon: "/teio.webp", portrait: "/teio-portrait.webp" },
  ];

  const choices = searchOshis(selected, matches);

  assert.equal(choices.length, 3);
  assert.equal(choices[0].id, "char-maruzensky");
  assert.equal(choices.filter((oshi) => oshi.id === "char-maruzensky").length, 1);
  assert.deepEqual(choices.slice(1, 3).map((oshi) => oshi.id), ["char-admire-groove", "char-teio"]);
});

test("search choices cap wide results at the stable grid size", () => {
  const selected = selectedOshiOption(createBundle(EVENTS, ACADEMY), "char-maruzensky");
  const matches = Array.from({ length: 20 }, (_, i) => ({
    id: `char-match-${i}`,
    name: `Match ${i}`,
    icon: `/match-${i}.webp`,
    portrait: `/match-${i}-portrait.webp`,
  }));

  const choices = searchOshis(selected, matches);

  assert.equal(choices.length, 12);
  assert.equal(choices[0].id, "char-maruzensky");
  assert.equal(choices.at(-1)?.id, "char-match-10");
});

test("persisted oshi falls back when the character is not trainee-backed", () => {
  assert.deepEqual(selectedOshiOption(createBundle(EVENTS, ACADEMY), "char-tazuna"), {
    id: "char-haru-urara",
    name: "Haru Urara",
    icon: "/img/characters/haru-urara_icon.webp",
    portrait: "/img/characters/haru-urara_portrait.webp",
  });
});

test("oshi search returns base characters that have trainee records", () => {
  const search = createOshiIndex(createBundle(EVENTS, ACADEMY));

  assert.deepEqual(search("tokai"), [
    { id: "char-teio", name: "Tokai Teio", icon: "/teio.webp", portrait: "/teio-portrait.webp" },
  ]);
  assert.deepEqual(search("reindeer"), []);
});

test("oshi search excludes staff and support-only characters", () => {
  const search = createOshiIndex(createBundle(EVENTS, ACADEMY));

  assert.deepEqual(search("tazuna"), []);
});
