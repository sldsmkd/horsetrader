import { test } from "node:test";
import assert from "node:assert/strict";

import { aboveLaneGroups } from "./aboveLane.ts";
import { createBundle } from "../bundle/access.ts";
import { createAxis } from "../axis.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";

const EVENTS: EventsBundle = {
  events: [
    // A past banner — now shown too (the timeline spans all known time).
    { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/past.webp", start: "2026-01-01", end: "2026-01-07", predicted: false, key: "banner-past" },
    // A trainee + support banner sharing a start — must collapse into one group.
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/sb2.webp", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "banner-s2" },
    { type: "trainee", rushable: true, contents: ["t-spe", "t-suzuka"], image: "/i/tb.webp", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "banner-t" },
    // A later support banner, predicted.
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
const NOW = "2026-06-08";

const EMPTY_EVENTS: EventsBundle = { events: [] };

test("above-lane: groups by start (all known time), banners only, sorted; shared start → one group", () => {
  const groups = aboveLaneGroups(bundle(), axis(), NOW);
  // cm-1 (not a banner) excluded; one group per distinct start, sorted left→right.
  assert.deepEqual(groups.map((g) => g.date), ["2026-01-01", "2026-06-10", "2026-06-25"]);

  const shared = groups[1]!; // the two banners on 2026-06-10 collapse here
  assert.equal(shared.x, 90); // 9 days × 10px, at the shared start
  assert.deepEqual(shared.banners.map((b) => b.key), ["banner-t", "banner-s2"]); // trainee before support
  assert.deepEqual(shared.banners.map((b) => b.kind), ["trainee", "support"]);

  assert.equal(groups[2]!.predicted, true); // any predicted banner → group predicted
});

test("contents resolve to atoms in the kind's grammar — trainee stars, support tier", () => {
  const groups = aboveLaneGroups(bundle(), axis(), NOW);
  const shared = groups.find((g) => g.date === "2026-06-10")!;

  const trainee = shared.banners.find((b) => b.key === "banner-t")!;
  assert.deepEqual(trainee.atoms, [
    { id: "t-spe", name: "Special Week", rarity: "3★" },
    { id: "t-suzuka", name: "Silence Suzuka", rarity: "3★" },
  ]);
  const support = shared.banners.find((b) => b.key === "banner-s2")!;
  assert.deepEqual(support.atoms, [{ id: "s-spe", name: "Special Week", rarity: "SSR" }]);
});

test("timestamped banners group and position by the selected viewer calendar", () => {
  const events: EventsBundle = {
    events: [
      { type: "support", rushable: false, contents: ["s-spe"], image: "/i/sb2.webp", start: "2026-06-10T22:00:00+00:00", end: "2026-06-16T22:00:00+00:00", predicted: false, key: "banner-s2" },
      { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/tb.webp", start: "2026-06-10T22:30:00+00:00", end: "2026-06-16T22:30:00+00:00", predicted: false, key: "banner-t" },
    ],
  };
  const groups = aboveLaneGroups(createBundle(events, ACADEMY, "Australia/Sydney"), axis(), NOW);

  assert.deepEqual(groups.map((g) => g.date), ["2026-06-11"]);
  assert.equal(groups[0]!.x, 100); // 2026-06-11 → 10 days after the origin
  assert.deepEqual(groups[0]!.banners.map((b) => b.key), ["banner-t", "banner-s2"]);
});

test("timestamped banners keep their UTC/server date when the view timezone is UTC", () => {
  const events: EventsBundle = {
    events: [
      { type: "support", rushable: false, contents: ["s-spe"], image: "/i/sb2.webp", start: "2026-06-10T22:00:00+00:00", end: "2026-06-16T22:00:00+00:00", predicted: false, key: "banner-s2" },
    ],
  };
  const groups = aboveLaneGroups(createBundle(events, ACADEMY, "UTC"), axis(), NOW);

  assert.deepEqual(groups.map((g) => g.date), ["2026-06-10"]);
});

test("empty bundle input returns no groups", () => {
  const groups = aboveLaneGroups(createBundle(EMPTY_EVENTS, ACADEMY), axis(), NOW);
  assert.deepEqual(groups, []);
});
