import { test } from "node:test";
import assert from "node:assert/strict";

import { aboveLaneGroups } from "./aboveLane.ts";
import type { CommitmentStatus } from "../../core/projection/pulls.ts";
import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import { createAxis } from "../axis.ts";
import { settle } from "../../core/engine/index.ts";
import type { SettledEvent, StreamCtx } from "../../core/engine/index.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";
import { cal } from "../../core/projection/dates.ts";

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
  characters: { "char-spe": { name: "Special Week", quote: null, icon: null, portrait: null, bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } }, "char-suzuka": { name: "Silence Suzuka", quote: null, icon: null, portrait: null, bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } } },
  supports: { "s-spe": { character: "char-spe", display: "Special Week", type: "guts", rarity: "ssr", title: "Tracen Academy", release: "2021", thumbnail: null, art: null, aliases: [], source: null } },
  trainees: {
    "t-spe": { character: "char-spe", variant: "Original", title: "[Special Dreamer]", rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [], source: null, aptitudes: null },
    "t-suzuka": { character: "char-suzuka", variant: "Original", title: "[Silent Innocence]", rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [], source: null, aptitudes: null },
  },
  courses: {},
  races: {},
  racetracks: {},
};

const bundle = () => createBundle(EVENTS, ACADEMY, TEST_CONFIG);
const axis = () => createAxis({ origin: cal("2026-06-01"), pxPerDay: 10 });
const NOW = cal("2026-06-08");

/** Settle baked records through the real settlement rule, bucketing into the
 *  given view calendar — the same shape `coordinator.settledEvents()` hands over. */
function settled(events: EventsBundle, timeZone = "UTC"): SettledEvent[] {
  const ctx = { timeZone, after: cal("2026-01-01") } as StreamCtx;
  return events.events.flatMap((record) => settle(record, ctx));
}

test("above-lane: groups by start (all known time), banners only, sorted; shared start → one group", () => {
  const groups = aboveLaneGroups(settled(EVENTS), bundle(), axis(), NOW);
  // cm-1 (not a banner) excluded; one group per distinct start, sorted left→right.
  assert.deepEqual(groups.map((g) => g.date), ["2026-01-01", "2026-06-10", "2026-06-25"]);

  const shared = groups[1]!; // the two banners on 2026-06-10 collapse here
  assert.equal(shared.x, 90); // 9 days × 10px, at the shared start
  assert.deepEqual(shared.banners.map((b) => b.key), ["banner-t", "banner-s2"]); // trainee before support
  assert.deepEqual(shared.banners.map((b) => b.kind), ["trainee", "support"]);

  assert.equal(groups[2]!.predicted, true); // any predicted banner → group predicted
  assert.equal(groups[0]!.past, true);
  assert.equal(shared.past, false);

  // A closed banner (end < now) is gone — `open` false, so no readout renders.
  assert.equal(groups[0]!.banners[0]!.open, false); // banner-past ended 2026-01-07
  assert.equal(groups[0]!.banners[0]!.past, true);
  assert.equal(shared.banners[0]!.open, true); // banner-t ends 2026-06-16, still open
  assert.equal(shared.banners[0]!.past, false);
});

test("contents resolve to atoms in the kind's grammar — trainee stars, support tier", () => {
  const groups = aboveLaneGroups(settled(EVENTS), bundle(), axis(), NOW);
  const shared = groups.find((g) => g.date === "2026-06-10")!;

  const trainee = shared.banners.find((b) => b.key === "banner-t")!;
  assert.deepEqual(trainee.atoms, [
    { id: "t-suzuka", name: "Silence Suzuka", rarity: "3★", rarityTier: "crystal", subtitle: "Silent Innocence", image: null },
    { id: "t-spe", name: "Special Week", rarity: "3★", rarityTier: "crystal", subtitle: "Special Dreamer", image: null },
  ]);
  const support = shared.banners.find((b) => b.key === "banner-s2")!;
  assert.deepEqual(support.atoms, [{ id: "s-spe", name: "Special Week", rarity: "SSR", rarityTier: "crystal", subtitle: "Tracen Academy", image: null, attribute: "guts" }]);
});

test("committed banners surface the cached funding status (pity + capacity)", () => {
  // The pull-math lives in commitmentStatus (see pulls.test.ts); the card just reads
  // the coordinator's cached answer instead of re-deriving it.
  const statuses = new Map<string, CommitmentStatus>([
    ["banner-t", { kind: "trainee", pity: 1, unfundable: false, capacity: { freePulls: 0, tickets: 0, dailyPaid: 6, freeCaratPulls: 16, total: 22 } }],
  ]);
  const groups = aboveLaneGroups(settled(EVENTS), bundle(), axis(), NOW, { balanceAt: () => ({}), availableFor: () => undefined, commitmentStatuses: statuses });
  const banner = groups.find((g) => g.date === "2026-06-10")!.banners.find((b) => b.key === "banner-t")!;

  assert.equal(banner.pullsAvailable, 22);
  assert.equal(banner.ticketPulls, 0);
  assert.equal(banner.paidCaratPulls, 6);
  assert.equal(banner.freeCaratPulls, 16);
  assert.equal(banner.committedPity, 1);
  assert.equal(banner.commitmentUnfundable, false);
});

test("committed banners surface the cached unfundable flag", () => {
  const statuses = new Map<string, CommitmentStatus>([
    ["banner-t", { kind: "trainee", pity: 1, unfundable: true, capacity: { freePulls: 0, tickets: 0, dailyPaid: 0, freeCaratPulls: 0, total: 0 } }],
  ]);
  const groups = aboveLaneGroups(settled(EVENTS), bundle(), axis(), NOW, { balanceAt: () => ({}), availableFor: () => undefined, commitmentStatuses: statuses });
  const banner = groups.find((g) => g.date === "2026-06-10")!.banners.find((b) => b.key === "banner-t")!;

  assert.equal(banner.committedPity, 1);
  assert.equal(banner.commitmentUnfundable, true);
});

test("uncommitted banners show pull capacity available before any own reservation", () => {
  const groups = aboveLaneGroups(settled(EVENTS), bundle(), axis(), NOW, {
    balanceAt: () => ({ free_carats: 30000, paid_carats: 600, trainee_tickets: 10 }),
    availableFor: () => undefined,
    commitmentStatuses: new Map(),
  });
  const banner = groups.find((g) => g.date === "2026-06-10")!.banners.find((b) => b.key === "banner-t")!;

  assert.equal(banner.pullsAvailable, 216); // 10 tickets + 6 daily paid + 200 free-carat pulls
  assert.equal(banner.ticketPulls, 10);
  assert.equal(banner.paidCaratPulls, 6);
  assert.equal(banner.freeCaratPulls, 200);
  assert.equal(banner.commitmentUnfundable, false);
});

test("banner-local free pulls are surfaced as the intrinsic value signal", () => {
  const events: EventsBundle = {
    events: [{ type: "support", rushable: false, contents: ["s-spe"], image: "/i/hot.webp", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "banner-hot", rewards: { pulls: 80 } }],
  };
  const groups = aboveLaneGroups(settled(events), createBundle(events, ACADEMY, TEST_CONFIG), axis(), NOW, {
    balanceAt: () => ({}),
    availableFor: () => undefined,
    commitmentStatuses: new Map(),
  });
  const banner = groups[0]!.banners[0]!;

  assert.equal(banner.freePulls, 80);
  assert.equal(banner.pullsAvailable, 80);
});

test("timestamped banners group and position by the selected viewer calendar", () => {
  const events: EventsBundle = {
    events: [
      { type: "support", rushable: false, contents: ["s-spe"], image: "/i/sb2.webp", start: "2026-06-10T22:00:00+00:00", end: "2026-06-16T22:00:00+00:00", predicted: false, key: "banner-s2" },
      { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/tb.webp", start: "2026-06-10T22:30:00+00:00", end: "2026-06-16T22:30:00+00:00", predicted: false, key: "banner-t" },
    ],
  };
  const groups = aboveLaneGroups(settled(events, "Australia/Sydney"), createBundle(events, ACADEMY, TEST_CONFIG, "Australia/Sydney"), axis(), NOW);

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
  const groups = aboveLaneGroups(settled(events, "UTC"), createBundle(events, ACADEMY, TEST_CONFIG, "UTC"), axis(), NOW);

  assert.deepEqual(groups.map((g) => g.date), ["2026-06-10"]);
});

test("empty settled world returns no groups", () => {
  const groups = aboveLaneGroups([], createBundle({ events: [] }, ACADEMY, TEST_CONFIG), axis(), NOW);
  assert.deepEqual(groups, []);
});
