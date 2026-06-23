import { test } from "node:test";
import assert from "node:assert/strict";

import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import { createOshiCostumeIndex, createOshiIndex, DEFAULT_OSHI_ID, searchOshis, selectedOshiOption, starterOshis } from "./oshi.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

const EVENTS: EventsBundle = { events: [] };

const ACADEMY: Academy = {
  characters: {
    "char-admire-groove": { name: "Admire Groove", quote: null, icon: "/admire.webp", portrait: "/admire-portrait.webp", bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
    "char-haru-urara": { name: "Haru Urara", quote: null, icon: "/urara.webp", portrait: "/urara-portrait.webp", bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
    "char-maruzensky": { name: "Maruzensky", quote: null, icon: "/maruzensky.webp", portrait: "/maruzensky-portrait.webp", bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
    "char-teio": { name: "Tokai Teio", quote: null, icon: "/teio.webp", portrait: "/teio-portrait.webp", bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
    "char-bitter-glasse": { name: "Bitter Glasse", quote: null, icon: "/bitter.webp", portrait: "/bitter-portrait.webp", bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
    "char-marche-lorraine": { name: "Marche Lorraine", quote: null, icon: "/marche.webp", portrait: null, bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
    "char-tazuna": { name: "Hayakawa Tazuna", quote: null, icon: "/tazuna.webp", portrait: null, bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
    "char-palmer": { name: "Mejiro Palmer", quote: null, icon: "/palmer.webp", portrait: null, bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
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
      source: null,
    },
  },
  trainees: {
    "trainee-admire-groove": {
      character: "char-admire-groove",
      variant: "Original",
      title: null,
      rarity: 3,
      release: "2021-02-24",
      thumbnail: null,
      portrait: null,
      aliases: [],
      source: null, aptitudes: null,
    },
    "trainee-haru-urara": {
      character: "char-haru-urara",
      variant: "Original",
      title: null,
      rarity: 1,
      release: "2021-02-24",
      thumbnail: null,
      portrait: null,
      aliases: [],
      source: null, aptitudes: null,
    },
    "trainee-maruzensky": {
      character: "char-maruzensky",
      variant: "Original",
      title: null,
      rarity: 3,
      release: "2021-02-24",
      thumbnail: null,
      portrait: "/maruzensky-racewear.webp",
      aliases: [],
      source: null, aptitudes: null,
    },
    "trainee-maruzensky-summer": {
      character: "char-maruzensky",
      variant: "Summer",
      title: "[Blasting Off Summer Night]",
      rarity: 3,
      release: "2021-07-29",
      thumbnail: null,
      portrait: "/maruzensky-summer.webp",
      aliases: [],
      source: null, aptitudes: null,
    },
    "trainee-teio-autumn": {
      character: "char-teio",
      variant: "Autumn Festival",
      title: null,
      rarity: 3,
      release: "2021-10-01",
      thumbnail: null,
      portrait: null,
      aliases: [],
      source: null, aptitudes: null,
    },
    "trainee-palmer-reindeer": {
      character: "char-palmer",
      variant: "Warm-Hearted Reindeer",
      title: null,
      rarity: 3,
      release: "2021-12-01",
      thumbnail: null,
      portrait: null,
      aliases: [],
      source: null, aptitudes: null,
    },
  },
  courses: {},
  races: {},
  racetracks: {}, selectors: {},
};

test("starter oshi slot 0 is the player-selection default", () => {
  assert.equal(DEFAULT_OSHI_ID, "char-haru-urara");
  assert.deepEqual(starterOshis(selectedOshiOption(createBundle(EVENTS, ACADEMY, TEST_CONFIG), null))[0], {
    id: "char-haru-urara",
    characterId: "char-haru-urara",
    name: "Haru Urara",
    icon: "/urara.webp",
    portrait: "/urara-portrait.webp",
  });
});

test("starter oshi slot 0 mirrors the persisted selected character", () => {
  const selected = selectedOshiOption(createBundle(EVENTS, ACADEMY, TEST_CONFIG), "char-admire-groove");

  assert.deepEqual(selected, {
    id: "char-admire-groove",
    characterId: "char-admire-groove",
    name: "Admire Groove",
    icon: "/admire.webp",
    portrait: "/admire-portrait.webp",
  });
  assert.deepEqual(starterOshis(selected)[0], selected);
});

test("starter oshi list dedupes selected seed characters and pads with overflow", () => {
  const selected = starterOshis(selectedOshiOption(createBundle(EVENTS, ACADEMY, TEST_CONFIG), "char-maruzensky"));

  assert.equal(selected.length, 12);
  assert.equal(selected.filter((oshi) => oshi.id === "char-maruzensky").length, 1);
  assert.deepEqual(selected.map((oshi) => oshi.id).slice(-2), ["char-gold-ship", "char-sakura-bakushin-o"]);
});

test("search choices keep selected in slot 0 without default backfill", () => {
  const selected = selectedOshiOption(createBundle(EVENTS, ACADEMY, TEST_CONFIG), "char-maruzensky");
  const matches = [
    { id: "char-admire-groove", characterId: "char-admire-groove", name: "Admire Groove", icon: "/admire.webp", portrait: "/admire-portrait.webp" },
    selected,
    { id: "char-teio", characterId: "char-teio", name: "Tokai Teio", icon: "/teio.webp", portrait: "/teio-portrait.webp" },
  ];

  const choices = searchOshis(selected, matches);

  assert.equal(choices.length, 3);
  assert.equal(choices[0].id, "char-maruzensky");
  assert.equal(choices.filter((oshi) => oshi.id === "char-maruzensky").length, 1);
  assert.deepEqual(choices.slice(1, 3).map((oshi) => oshi.id), ["char-admire-groove", "char-teio"]);
});

test("search choices cap wide results at the stable grid size", () => {
  const selected = selectedOshiOption(createBundle(EVENTS, ACADEMY, TEST_CONFIG), "char-maruzensky");
  const matches = Array.from({ length: 20 }, (_, i) => ({
    id: `char-match-${i}`,
    characterId: `char-match-${i}`,
    name: `Match ${i}`,
    icon: `/match-${i}.webp`,
    portrait: `/match-${i}-portrait.webp`,
  }));

  const choices = searchOshis(selected, matches);

  assert.equal(choices.length, 12);
  assert.equal(choices[0].id, "char-maruzensky");
  assert.equal(choices.at(-1)?.id, "char-match-10");
});

test("persisted oshi accepts a non-trainee character with complete identity art", () => {
  assert.deepEqual(selectedOshiOption(createBundle(EVENTS, ACADEMY, TEST_CONFIG), "char-bitter-glasse"), {
    id: "char-bitter-glasse",
    characterId: "char-bitter-glasse",
    name: "Bitter Glasse",
    icon: "/bitter.webp",
    portrait: "/bitter-portrait.webp",
  });
});

test("persisted oshi can be a trainee costume key", () => {
  assert.deepEqual(selectedOshiOption(createBundle(EVENTS, ACADEMY, TEST_CONFIG), "trainee-maruzensky-summer"), {
    id: "trainee-maruzensky-summer",
    characterId: "char-maruzensky",
    name: "Maruzensky",
    icon: "/maruzensky.webp",
    portrait: "/maruzensky-summer.webp",
    costumeName: "Summer",
  });
});

test("persisted oshi falls back when the character is missing portrait art", () => {
  assert.deepEqual(selectedOshiOption(createBundle(EVENTS, ACADEMY, TEST_CONFIG), "char-tazuna"), {
    id: "char-haru-urara",
    characterId: "char-haru-urara",
    name: "Haru Urara",
    icon: "/img/characters/haru-urara_icon.webp",
    portrait: "/img/characters/haru-urara_portrait.webp",
  });
});

test("oshi search returns characters with complete identity art", () => {
  const search = createOshiIndex(createBundle(EVENTS, ACADEMY, TEST_CONFIG));

  assert.deepEqual(search("tokai"), [
    { id: "char-teio", characterId: "char-teio", name: "Tokai Teio", icon: "/teio.webp", portrait: "/teio-portrait.webp" },
  ]);
  assert.deepEqual(search("bitter"), [
    { id: "char-bitter-glasse", characterId: "char-bitter-glasse", name: "Bitter Glasse", icon: "/bitter.webp", portrait: "/bitter-portrait.webp" },
  ]);
  assert.deepEqual(search("reindeer"), []);
});

test("oshi search excludes characters missing portrait art", () => {
  const search = createOshiIndex(createBundle(EVENTS, ACADEMY, TEST_CONFIG));

  assert.deepEqual(search("tazuna"), []);
  assert.deepEqual(search("marche"), []);
});

test("oshi costume index returns base portrait plus trainee costumes", () => {
  const costumes = createOshiCostumeIndex(createBundle(EVENTS, ACADEMY, TEST_CONFIG))("char-maruzensky");

  assert.deepEqual(costumes, [
    {
      id: "char-maruzensky",
      characterId: "char-maruzensky",
      name: "Maruzensky",
      icon: "/maruzensky.webp",
      portrait: "/maruzensky-portrait.webp",
    },
    {
      id: "trainee-maruzensky",
      characterId: "char-maruzensky",
      name: "Maruzensky",
      icon: "/maruzensky.webp",
      portrait: "/maruzensky-racewear.webp",
      costumeName: "Race Wear",
    },
    {
      id: "trainee-maruzensky-summer",
      characterId: "char-maruzensky",
      name: "Maruzensky",
      icon: "/maruzensky.webp",
      portrait: "/maruzensky-summer.webp",
      costumeName: "Summer",
    },
  ]);
});

test("oshi costume index omits characters without complete base art", () => {
  const costumes = createOshiCostumeIndex(createBundle(EVENTS, ACADEMY, TEST_CONFIG));

  assert.deepEqual(costumes("char-marche-lorraine"), []);
});
