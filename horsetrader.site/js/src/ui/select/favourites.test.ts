import { test } from "node:test";
import assert from "node:assert/strict";

import { favouriteBannerAppearances } from "./favourites.ts";
import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";
import { cal } from "../../core/projection/dates.ts";

const EVENTS: EventsBundle = {
  events: [
    { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/p.webp", start: "2026-01-01", end: "2026-01-07", predicted: false, key: "banner-past" },
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/open.webp", start: "2026-05-28", end: "2026-06-04", predicted: false, key: "banner-open" },
    { type: "trainee", rushable: true, contents: ["t-spe", "t-other"], image: "/i/t.webp", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "banner-fav-t" },
    { type: "support", rushable: false, contents: ["s-other"], image: "/i/s.webp", start: "2026-06-12", end: "2026-06-18", predicted: false, key: "banner-nofav" },
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/s2.webp", start: "2026-06-20", end: "2026-06-26", predicted: true, key: "banner-fav-s" },
    { type: "cm", name: "CM", start: "2026-06-22", end: "2026-06-26", predicted: false, key: "cm-fav" },
  ],
};

const ACADEMY: Academy = {
  characters: { "char-spe": { name: "Special Week", quote: null, icon: null, portrait: null, bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } } },
  supports: {
    "s-spe": { character: "char-spe", display: "Special Week", type: "guts", rarity: "ssr", title: null, release: "2021", thumbnail: null, art: null, aliases: [], source: null },
    "s-other": { character: "char-spe", display: "Other Support", type: "speed", rarity: "ssr", title: null, release: "2021", thumbnail: null, art: null, aliases: [], source: null },
  },
  trainees: {
    "t-spe": { character: "char-spe", variant: "Original", title: null, rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [], source: null, aptitudes: null },
    "t-other": { character: "char-spe", variant: "Other", title: null, rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [], source: null, aptitudes: null },
  },
  courses: {},
  races: {},
  racetracks: {}, selectors: {},
};

const bundle = () => createBundle(EVENTS, ACADEMY, TEST_CONFIG);

test("favouriteBannerAppearances: future banners containing favourited atoms only", () => {
  const rows = favouriteBannerAppearances(bundle(), { "t-spe": {}, "s-spe": {}, "cm-fav": {} }, cal("2026-06-01"));

  assert.deepEqual(rows, [
    { date: cal("2026-05-28"), eventKey: "banner-open", kind: "support", predicted: false, atomIds: ["s-spe"] },
    { date: cal("2026-06-10"), eventKey: "banner-fav-t", kind: "trainee", predicted: false, atomIds: ["t-spe"] },
    { date: cal("2026-06-20"), eventKey: "banner-fav-s", kind: "support", predicted: true, atomIds: ["s-spe"] },
  ]);
});
