import { test } from "node:test";
import assert from "node:assert/strict";

import { bookmarkRows, nextBookmarkDate } from "./bookmarks.ts";
import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";
import { cal } from "../../core/projection/dates.ts";

const EVENTS: EventsBundle = {
  events: [
    // A past banner holding a favourited atom — excluded (bookmarks are future-only).
    { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/p.webp", start: "2026-01-01", end: "2026-01-07", predicted: false, key: "banner-past" },
    // A future trainee banner holding the favourited atom → a row.
    { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/t.webp", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "banner-fav-t" },
    // A future support banner with no favourited atom → excluded.
    { type: "support", rushable: false, contents: ["s-other"], image: "/i/s.webp", start: "2026-06-12", end: "2026-06-18", predicted: false, key: "banner-nofav" },
    // Two predicted banners on the *same* future beat, each holding a favourited
    // atom → one combined row carrying both atoms, reading predicted.
    { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/c1.webp", start: "2026-06-25", end: "2026-07-01", predicted: true, key: "banner-co-t" },
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/c2.webp", start: "2026-06-25", end: "2026-07-01", predicted: false, key: "banner-co-s" },
    // A non-banner future event whose key is favourited → excluded (banners only).
    { type: "cm", name: "CM", start: "2026-06-22", end: "2026-06-26", predicted: false, key: "cm-fav" },
  ],
};

const ACADEMY: Academy = {
  characters: { "char-spe": { name: "Special Week", quote: null, icon: "/img/spe-icon.webp", portrait: "/img/spe-portrait.webp", bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } } },
  supports: { "s-spe": { character: "char-spe", display: "Special Week", type: "guts", rarity: "ssr", title: "The Setting Sun And Rising Stars", release: "2021", thumbnail: "/img/s-spe.webp", art: null, aliases: [], source: null } },
  trainees: { "t-spe": { character: "char-spe", variant: "Special Dreamer", title: null, rarity: 3, release: "2021", thumbnail: "/img/t-spe.webp", portrait: null, aliases: [], source: null, aptitudes: null } },
  courses: {},
  races: {},
  racetracks: {},
};

const bundle = () => createBundle(EVENTS, ACADEMY, TEST_CONFIG);

test("bookmarkRows: favourited atoms lead rows, sorted by nearest future appearance; past/unfav/non-banner excluded", () => {
  // Favourites are keyed by atom (content) id, not banner key — the real model.
  const favourites = { "t-spe": {}, "s-spe": {}, "cm-fav": {} };
  const rows = bookmarkRows(bundle(), favourites, cal("2026-06-01"));

  assert.deepEqual(
    rows.map((r) => ({ id: r.id, name: r.name, subtext: r.subtext, image: r.image, dates: r.appearances.map((a) => a.date) })),
    [
      { id: "t-spe", name: "Special Week", subtext: "3★ · Special Dreamer", image: "/img/t-spe.webp", dates: ["2026-06-10", "2026-06-25"] },
      { id: "s-spe", name: "Special Week", subtext: "SSR · Guts · The Setting Sun And Rising Stars", image: "/img/s-spe.webp", dates: ["2026-06-25"] },
    ],
  );
});

test("bookmarkRows: appearance metadata preserves kind and prediction without collapsing co-occurring atoms", () => {
  const favourites = { "t-spe": {}, "s-spe": {} };
  const rows = bookmarkRows(bundle(), favourites, cal("2026-06-01"));

  const trainee = rows.find((r) => r.kind === "trainee");
  assert.ok(trainee, "expected the favourited trainee row");
  assert.equal(trainee.rarityTier, "crystal");
  assert.deepEqual(trainee.appearances.map((a) => [a.date, a.predicted]), [
    ["2026-06-10", false],
    ["2026-06-25", true],
  ]);

  const support = rows.find((r) => r.kind === "support");
  assert.ok(support, "expected the favourited support row");
  assert.equal(support.attribute, "guts");
  assert.equal(support.rarityTier, "crystal");
  assert.deepEqual(support.appearances.map((a) => [a.date, a.predicted]), [["2026-06-25", false]]);
});

test("bookmarkRows: no favourites ⇒ no rows (the drawer's empty state)", () => {
  assert.deepEqual(bookmarkRows(bundle(), {}, cal("2026-06-01")), []);
});

test("nextBookmarkDate: advances after the centred appearance and wraps to the first", () => {
  const [row] = bookmarkRows(bundle(), { "t-spe": {} }, cal("2026-06-01"));
  assert.ok(row, "expected favourite row");

  assert.equal(nextBookmarkDate(row, cal("2026-06-01")), "2026-06-10");
  assert.equal(nextBookmarkDate(row, cal("2026-06-10")), "2026-06-25");
  assert.equal(nextBookmarkDate(row, cal("2026-06-26")), "2026-06-10");
});
