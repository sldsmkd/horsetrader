import { test } from "node:test";
import assert from "node:assert/strict";

import { planRows } from "./plan.ts";
import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";
import type { CommitmentStatus, PullCapacity } from "../../core/projection/pulls.ts";

const EVENTS: EventsBundle = {
  events: [
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/sb.webp", start: "2026-07-01", end: "2026-07-07", predicted: false, key: "banner-s" },
    { type: "trainee", rushable: true, contents: ["t-spe", "t-suzuka"], image: "/i/tb.webp", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "banner-t", rewards: { pulls: 10 } },
    { type: "story", rushable: true, title: "A Story", contents: [], image: null, banner: null, art: null, era: "1m", start: "2026-06-01", end: "2026-06-08", predicted: false, key: "story-x" },
  ],
};

const ACADEMY: Academy = {
  characters: {
    "char-spe": { name: "Special Week", quote: null, icon: null, portrait: null, bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
    "char-suzuka": { name: "Silence Suzuka", quote: null, icon: null, portrait: null, bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } },
  },
  supports: {
    "s-spe": { character: "char-spe", display: "Special Week", type: "guts", rarity: "ssr", title: null, release: "2021", thumbnail: "/img/s-spe.webp", art: null, aliases: [], source: null },
  },
  trainees: {
    "t-spe": { character: "char-spe", variant: "Original", title: null, rarity: 3, release: "2021", thumbnail: "/img/t-spe.webp", portrait: null, aliases: [], source: null, aptitudes: null },
    "t-suzuka": { character: "char-suzuka", variant: "Original", title: null, rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [], source: null, aptitudes: null },
  },
  courses: {},
  races: {},
  racetracks: {},
};

const bundle = () => createBundle(EVENTS, ACADEMY, TEST_CONFIG);
const CAP: PullCapacity = { freePulls: 0, tickets: 0, dailyPaid: 0, freeCaratPulls: 0, total: 0 };
const status = (kind: "trainee" | "support", pity: number): CommitmentStatus => ({ kind, pity, unfundable: false, capacity: CAP });

test("planRows is the committed set, one row per banner, sorted along the time spine", () => {
  const statuses = new Map<string, CommitmentStatus>([
    ["banner-s", status("support", 3)],
    ["banner-t", status("trainee", 1)],
  ]);
  const rows = planRows(bundle(), statuses, () => "positive");

  // Sorted by start: the trainee banner (Jun 10) leads the support one (Jul 1).
  assert.deepEqual(rows.map((r) => r.key), ["banner-t", "banner-s"]);
  assert.equal(rows[0]!.kind, "trainee");
  assert.equal(rows[0]!.pity, 1);
  assert.equal(rows[0]!.band, "positive");
});

test("a banner's label is its lead featured atom + a count of the rest", () => {
  const statuses = new Map<string, CommitmentStatus>([["banner-t", status("trainee", 1)]]);
  const [row] = planRows(bundle(), statuses, () => "positive");
  assert.equal(row!.label, "Special Week +1"); // two featured trainees → lead + 1
});

test("the band colour is whatever the app hands in (shared pityBand rule)", () => {
  const statuses = new Map<string, CommitmentStatus>([["banner-s", status("support", 9)]]);
  const rows = planRows(bundle(), statuses, () => "unfundable");
  assert.equal(rows[0]!.band, "unfundable");
});

test("each row carries the banner's forecast input, the committed pity folded in", () => {
  const statuses = new Map<string, CommitmentStatus>([["banner-s", status("support", 2)]]);
  const [row] = planRows(bundle(), statuses, () => "positive");
  assert.equal(row!.forecast.pity, 2); // the commitment's pity drives the distribution
  assert.equal(row!.forecast.maxCopies, 5); // MLB / 5★ cap
  assert.ok(row!.forecast.pullsPerPity > 0); // spark threshold from gacha config
});
