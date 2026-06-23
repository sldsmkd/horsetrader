import { test } from "node:test";
import assert from "node:assert/strict";

import { cardDetails } from "./cardDetail.ts";
import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

const EVENTS: EventsBundle = { events: [] };

const ACADEMY: Academy = {
  characters: {
    "char-spe": { name: "Special Week", quote: null, icon: "/img/spe-icon.webp", portrait: "/img/spe-portrait.webp", bio: { three_sizes: { bust: 90, waist: 60, hips: 88 }, birthday: { month: 5, day: 3 }, height: 159 } },
    // A character the scrape hasn't filled — bio container present, members null.
    "char-npc": { name: "Nobody", quote: null, icon: null, portrait: null, bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
  },
  supports: {
    // SSR support with a source URL — full facets + the deep-link present.
    "s-spe": {
      character: "char-spe", display: "Special Week", type: "guts", rarity: "ssr",
      title: "The Setting Sun And Rising Stars", release: "2021-06-24",
      thumbnail: "/img/s-spe-thumb.webp", art: "/img/s-spe-art.webp", aliases: [],
      source: "https://gametora.com/umamusume/supports/30001-special-week",
    },
    // R support with no source — no link, falls back to thumbnail art.
    "s-bare": {
      character: null, display: "Nobody", type: null, rarity: "r", title: null,
      release: "2021-02-24", thumbnail: "/img/s-bare-thumb.webp", art: null, aliases: [],
      source: null,
    },
  },
  trainees: {
    // A trainee whose character has an empty bio container (scrape lag).
    "t-npc": {
      character: "char-npc", variant: "Original", title: null,
      rarity: 1, release: "2021-02-24", thumbnail: null, portrait: null, aliases: [],
      source: null, aptitudes: null,
    },
    // 3★ trainee with a portrait + source.
    "t-spe": {
      character: "char-spe", variant: "Special Dreamer", title: "[Jubilant Star]",
      rarity: 3, release: "2021-02-24", thumbnail: "/img/t-spe-thumb.webp",
      portrait: "/img/t-spe-portrait.webp", aliases: [],
      source: "https://gametora.com/umamusume/characters/100101-special-week",
      aptitudes: {
        surface: { turf: "a", dirt: "g" },
        distance: { short: "f", mile: "c", medium: "a", long: "a" },
        strategy: { front: "g", pace: "b", late: "a", end: "c" },
      },
    },
  },
  courses: {},
  races: {},
  racetracks: {}, selectors: {},
};

const bundle = () => createBundle(EVENTS, ACADEMY, TEST_CONFIG);

test("cardDetails(trainee): name via character, ★ rarity, portrait art, variant facet + title tagline, source", () => {
  const d = cardDetails(bundle(), "trainee", "t-spe");
  assert.equal(d.name, "Special Week");
  assert.equal(d.rarity, "3★");
  assert.equal(d.rarityTier, "crystal");
  assert.equal(d.art, "/img/t-spe-portrait.webp"); // portrait preferred over thumbnail
  assert.equal(d.tagline, "[Jubilant Star]"); // title reads as the flavour tagline
  assert.deepEqual(d.facets, [
    { label: "Variant", value: "Special Dreamer" },
  ]);
  assert.equal(d.source, "https://gametora.com/umamusume/characters/100101-special-week");
  // Bio vitals project off the resolved character, formatted for display.
  assert.deepEqual(d.bio, [
    { label: "Birthday", value: "May 3" },
    { label: "Height", value: "159 cm" },
    { label: "Three Sizes", value: "B90 / W60 / H88" },
  ]);
  // Aptitudes project onto three axes in source reading order, ranks as slugs.
  assert.deepEqual(d.aptitudes, [
    { label: "Surface", grades: [
      { slot: "Turf", rank: "a" }, { slot: "Dirt", rank: "g" },
    ] },
    { label: "Distance", grades: [
      { slot: "Short", rank: "f" }, { slot: "Mile", rank: "c" },
      { slot: "Medium", rank: "a" }, { slot: "Long", rank: "a" },
    ] },
    { label: "Strategy", grades: [
      { slot: "Front", rank: "g" }, { slot: "Pace", rank: "b" },
      { slot: "Late", rank: "a" }, { slot: "End", rank: "c" },
    ] },
  ]);
});

test("cardDetails(support): display name, uppercased rarity, art hero, type pip facet + title tagline", () => {
  const d = cardDetails(bundle(), "support", "s-spe");
  assert.equal(d.name, "Special Week");
  assert.equal(d.rarity, "SSR");
  assert.equal(d.rarityTier, "crystal");
  assert.equal(d.art, "/img/s-spe-art.webp"); // art preferred over thumbnail
  assert.equal(d.tagline, "The Setting Sun And Rising Stars"); // title reads as the flavour tagline
  assert.deepEqual(d.facets, [
    { label: "Type", value: "Guts", attribute: "guts" },
  ]);
  assert.equal(d.source, "https://gametora.com/umamusume/supports/30001-special-week");
  assert.equal(d.aptitudes, null); // supports carry no aptitude block
});

test("cardDetails: a null source carries through (the view omits the link)", () => {
  const d = cardDetails(bundle(), "support", "s-bare");
  assert.equal(d.source, null);
  assert.equal(d.art, "/img/s-bare-thumb.webp"); // no art → thumbnail
  assert.equal(d.rarityTier, "gold"); // non-ssr
  assert.equal(d.tagline, null); // no title → no tagline
  assert.deepEqual(d.facets, []); // no type
});

test("cardDetails: bio is empty when the character is absent or its members are null", () => {
  assert.deepEqual(cardDetails(bundle(), "support", "s-bare").bio, []); // no character
  assert.deepEqual(cardDetails(bundle(), "trainee", "t-npc").bio, []); // null members
});

test("cardDetails: a bad id throws (resolve-or-throw, trust the bake)", () => {
  assert.throws(() => cardDetails(bundle(), "trainee", "t-missing"), /no trainee for "t-missing"/);
  assert.throws(() => cardDetails(bundle(), "support", "s-missing"), /no support for "s-missing"/);
});
