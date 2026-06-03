import { test } from "node:test";
import assert from "node:assert/strict";

import { aboveLaneBanners } from "./aboveLane.ts";
import { createBundle } from "../bundle/access.ts";
import { createAxis } from "../axis.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

const EVENTS: EventsBundle = {
  events: [
    // A past banner (ended before the horizon) — must be excluded.
    { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/past.webp", start: "2026-01-01", end: "2026-01-07", predicted: false, key: "banner-past" },
    // A future trainee banner.
    { type: "trainee", rushable: true, contents: ["t-spe", "t-suzuka"], image: "/i/tb.webp", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "banner-t" },
    // A future support banner, predicted.
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/sb.webp", start: "2026-06-25", end: "2026-07-01", predicted: true, key: "banner-s" },
    // A below-lane event — not a banner, must be excluded.
    { type: "cm", name: "CM", start: "2026-06-27", end: "2026-07-01", predicted: false, key: "cm-1" },
  ],
};

const ACADEMY: Academy = {
  characters: { "char-spe": { name: "Special Week", quote: null, icon: null, portrait: null }, "char-suzuka": { name: "Silence Suzuka", quote: null, icon: null, portrait: null } },
  supports: { "s-spe": { character: "char-spe", display: "Special Week", type: "guts", rarity: "ssr", title: null, release: "2021", thumbnail: null, art: null, aliases: [] } },
  trainees: {
    "t-spe": { character: "char-spe", variant: null, rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [] },
    "t-suzuka": { character: "char-suzuka", variant: null, rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [] },
  },
};

const bundle = () => createBundle(EVENTS, ACADEMY);
const axis = () => createAxis({ origin: "2026-06-01", pxPerDay: 10 });

test("above-lane: banners only, future-scoped, positioned at appearance (start), sorted", () => {
  const cards = aboveLaneBanners(bundle(), axis(), "2026-06-01");
  // banner-past (ended pre-horizon) and cm-1 (not a banner) are excluded.
  assert.deepEqual(cards.map((c) => c.key), ["banner-t", "banner-s"]);
  assert.deepEqual(cards.map((c) => c.kind), ["trainee", "support"]);
  assert.equal(cards[0]!.date, "2026-06-10"); // the start, not the end
  assert.equal(cards[0]!.x, 90); // 9 days × 10px
  assert.equal(cards[1]!.predicted, true);
});

test("contents resolve to atoms in the kind's grammar — trainee stars, support tier", () => {
  const cards = aboveLaneBanners(bundle(), axis(), "2026-06-01");
  const trainee = cards.find((c) => c.key === "banner-t")!;
  assert.deepEqual(trainee.atoms, [
    { id: "t-spe", name: "Special Week", rarity: "3★" },
    { id: "t-suzuka", name: "Silence Suzuka", rarity: "3★" },
  ]);
  const support = cards.find((c) => c.key === "banner-s")!;
  assert.deepEqual(support.atoms, [{ id: "s-spe", name: "Special Week", rarity: "SSR" }]);
});
