import { test } from "node:test";
import assert from "node:assert/strict";

import { balancePoints, caratToY, fretLevels, dotMarks, BAND, PITY } from "./minimap.ts";
import { balanceSeries } from "../../core/projection/ledger.ts";
import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";
import { cal } from "../../core/projection/dates.ts";

const EVENTS: EventsBundle = {
  events: [
    // A past favourited banner — must be excluded from the dots (future-only).
    { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/p.webp", start: "2026-01-01", end: "2026-01-07", predicted: false, key: "banner-past" },
    // A future trainee banner, favourited → a green dot.
    { type: "trainee", rushable: true, contents: ["t-spe"], image: "/i/t.webp", start: "2026-06-10", end: "2026-06-16", predicted: false, key: "banner-fav-t" },
    // A future support banner, NOT favourited → no dot.
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/s.webp", start: "2026-06-12", end: "2026-06-18", predicted: false, key: "banner-nofav" },
    // A future support banner, favourited → a blue dot.
    { type: "support", rushable: false, contents: ["s-spe"], image: "/i/s2.webp", start: "2026-06-20", end: "2026-06-26", predicted: false, key: "banner-fav-s" },
    // A non-banner future event, favourited → still excluded (banners only).
    { type: "cm", name: "CM", start: "2026-06-22", end: "2026-06-26", predicted: false, key: "cm-fav" },
  ],
};

const ACADEMY: Academy = {
  characters: { "char-spe": { name: "Special Week", quote: null, icon: null, portrait: null } },
  supports: { "s-spe": { character: "char-spe", display: "Special Week", type: "guts", rarity: "ssr", title: null, release: "2021", thumbnail: null, art: null, aliases: [] } },
  trainees: { "t-spe": { character: "char-spe", variant: null, rarity: 3, release: "2021", thumbnail: null, portrait: null, aliases: [] } },
};

const bundle = () => createBundle(EVENTS, ACADEMY, TEST_CONFIG);

test("balancePoints: change-points inside extent, plus the two extent ends, sorted; exact carat balance", () => {
  // Two change-points; balance walks +30k then −80k (crosses zero negative).
  const series = balanceSeries(
    { free_carats: 0 },
    [
      { date: cal("2026-06-05"), stream: "x", source: "a", resource: "free_carats", amount: 30_000 },
      { date: cal("2026-06-08"), stream: "x", source: "b", resource: "free_carats", amount: -80_000 },
    ],
  );
  const pts = balancePoints(series, [cal("2026-06-01"), cal("2026-06-12")]);
  assert.deepEqual(pts, [
    { date: cal("2026-06-01"), carats: 0 }, // extent start — flat run before the first change-point (base)
    { date: cal("2026-06-05"), carats: 30_000 },
    { date: cal("2026-06-08"), carats: -50_000 },
    { date: cal("2026-06-12"), carats: -50_000 }, // extent end — holds the final balance
  ]);
});

test("balancePoints: change-points outside the extent are dropped", () => {
  const series = balanceSeries(
    { free_carats: 100 },
    [{ date: cal("2026-01-01"), stream: "x", source: "a", resource: "free_carats", amount: 50 }],
  );
  // Extent sits entirely after the only change-point: just the two ends, both final.
  const pts = balancePoints(series, [cal("2026-06-01"), cal("2026-06-02")]);
  assert.deepEqual(pts.map((p) => p.date), ["2026-06-01", "2026-06-02"]);
  assert.deepEqual(pts.map((p) => p.carats), [150, 150]);
});

test("caratToY: origin centres, +BAND at top, −BAND at bottom, clamps beyond", () => {
  const H = 100;
  assert.equal(caratToY(0, H), 50); // origin → centre
  assert.equal(caratToY(BAND, H), 0); // +90k → top
  assert.equal(caratToY(-BAND, H), 100); // −90k → bottom
  assert.equal(caratToY(2 * BAND, H), 0); // clamp above the band
  assert.equal(caratToY(-2 * BAND, H), 100); // clamp below the band
  assert.ok(Math.abs(caratToY(PITY, H) - 100 / 3) < 1e-9); // +1 pity → one fret up from centre
});

test("fretLevels: every pity boundary across ±3, top to bottom", () => {
  assert.deepEqual(fretLevels(), [90_000, 60_000, 30_000, 0, -30_000, -60_000, -90_000]);
});

test("dotMarks: favourited future banners only, kind preserved; past/unfav/non-banner excluded", () => {
  const favourites = { "banner-past": {}, "banner-fav-t": {}, "banner-fav-s": {}, "cm-fav": {} };
  const marks = dotMarks(bundle(), favourites, cal("2026-06-01"));
  assert.deepEqual(marks, [
    { date: cal("2026-06-10"), kind: "trainee" },
    { date: cal("2026-06-20"), kind: "support" },
  ]);
});
