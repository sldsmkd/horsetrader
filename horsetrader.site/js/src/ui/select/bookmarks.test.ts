import { test } from "node:test";
import assert from "node:assert/strict";

import { bookmarkRows } from "./bookmarks.ts";
import { createBundle } from "../bundle/access.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

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
  characters: { "char-spe": { name: "Special Week", quote: null, icon: null, portrait: null } },
  supports: { "s-spe": { character: "char-spe", display: "Special Week SSR", type: "guts", rarity: "ssr", title: null, release: "2021", thumbnail: null, art: null, aliases: [] } },
  trainees: { "t-spe": { character: "char-spe", variant: null, rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [] } },
};

const bundle = () => createBundle(EVENTS, ACADEMY);

test("bookmarkRows: future banners holding a favourited atom, sorted nearest-first; past/unfav/non-banner excluded", () => {
  // Favourites are keyed by atom (content) id, not banner key — the real model.
  const favourites = { "t-spe": {}, "s-spe": {}, "cm-fav": {} };
  const rows = bookmarkRows(bundle(), favourites, "2026-06-01");

  assert.deepEqual(
    rows.map((r) => ({ date: r.date, predicted: r.predicted })),
    [
      { date: "2026-06-10", predicted: false },
      { date: "2026-06-25", predicted: true }, // co-occurring beat; one banner predicted ⇒ row predicted
    ],
  );
});

test("bookmarkRows: co-occurring favourites combine into one row, kinds preserved", () => {
  const favourites = { "t-spe": {}, "s-spe": {} };
  const rows = bookmarkRows(bundle(), favourites, "2026-06-01");

  const co = rows.find((r) => r.date === "2026-06-25");
  assert.ok(co, "expected a combined row on the shared beat");
  assert.deepEqual(co.atoms.map((a) => a.kind), ["trainee", "support"]);
  assert.deepEqual(co.atoms.map((a) => a.atom.name), ["Special Week", "Special Week SSR"]);
});

test("bookmarkRows: no favourites ⇒ no rows (the drawer's empty state)", () => {
  assert.deepEqual(bookmarkRows(bundle(), {}, "2026-06-01"), []);
});
