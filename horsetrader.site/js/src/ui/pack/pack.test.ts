import { test } from "node:test";
import assert from "node:assert/strict";

import { packBelow, packAbove } from "./pack.ts";
import type { Box, BelowConfig, AboveBox } from "./pack.ts";

/** A square-ish collision box: width 100, gaps 10 — so centres ≥ 110 apart don't x-collide. */
const CFG: BelowConfig = { width: 100, gapX: 10, gapY: 10 };

test("below: no x-overlap → every card flush against the line (offset 0)", () => {
  // Centres 200 apart, well past the 110 collision threshold.
  const boxes: Box[] = [
    { x: 0, height: 40 },
    { x: 200, height: 60 },
    { x: 400, height: 50 },
  ];
  assert.deepEqual(packBelow(boxes, CFG), [0, 0, 0]);
});

test("below: two overlapping cards stack — one flush, the next a card+gap below", () => {
  const boxes: Box[] = [
    { x: 0, height: 40 },
    { x: 50, height: 40 }, // 50 < 110 → collides with the first
  ];
  // Same height, so tie-break by x: the left one places first at 0, the right
  // one drops to 40 (height) + 10 (gapY) = 50.
  assert.deepEqual(packBelow(boxes, CFG), [0, 50]);
});

test("below: tallest-first stacks shorts that also overlap each other", () => {
  // All three mutually x-overlap (centres within 110). Heights 100 / 20 / 20.
  // Tall places first at 0; the shorts can't sit at 0 (tall's column) and can't
  // share a row with each other, so they stack below it: 100+10=110, then 130+10.
  const boxes: Box[] = [
    { x: 100, height: 100 }, // tall, in the middle
    { x: 70, height: 20 }, // placed first of the shorts (smaller x)
    { x: 130, height: 20 }, // overlaps both the tall card AND the other short
  ];
  const offsets = packBelow(boxes, CFG);
  assert.equal(offsets[0], 0); // tall card flush against the line
  assert.equal(offsets[1], 110); // first short, just below the tall card
  assert.equal(offsets[2], 140); // second short, below the first (110 + 20 + gapY)
});

test("below: shorts that clear each other tuck side-by-side below a tall card", () => {
  // Heights 100 / 20 / 20; the shorts are >110 apart so they DON'T collide with
  // each other — both drop to the same row below the tall card, no needless stack.
  const boxes: Box[] = [
    { x: 100, height: 100 }, // tall, in the middle
    { x: 40, height: 20 }, // 120 from the other short → no mutual collision
    { x: 160, height: 20 },
  ];
  const offsets = packBelow(boxes, CFG);
  assert.deepEqual(offsets, [0, 110, 110]);
});

test("below: a short card slides up beside a tall one when it clears horizontally", () => {
  // Tall card at x=0; a short card far enough right to NOT x-collide returns to 0;
  // another short card overlapping the tall one must drop below it.
  const boxes: Box[] = [
    { x: 0, height: 100 }, // tall
    { x: 300, height: 20 }, // clear of the tall card → flush at 0
    { x: 50, height: 20 }, // overlaps the tall card → must drop below it
  ];
  const offsets = packBelow(boxes, CFG);
  assert.equal(offsets[0], 0);
  assert.equal(offsets[1], 0); // no collision, stays flush
  assert.equal(offsets[2], 110); // 100 + gapY, below the tall card
});

test("below: offsets are aligned to input order, not placement order", () => {
  // Index 1 is the tallest (placed first) but its offset still lands at result[1].
  const boxes: Box[] = [
    { x: 0, height: 20 },
    { x: 40, height: 100 }, // tallest, overlaps index 0
  ];
  const offsets = packBelow(boxes, CFG);
  assert.equal(offsets.length, 2);
  assert.equal(offsets[1], 0); // tallest placed first, flush
  assert.equal(offsets[0], 110); // shorter, dropped below the tall card
});

test("below: empty input → empty offsets", () => {
  assert.deepEqual(packBelow([], CFG), []);
});

test("above: groups with room keep their true x (no nudge)", () => {
  // Centres 200 apart, width 100 + gap 8 → no overlap.
  const boxes: AboveBox[] = [
    { x: 0, width: 100 },
    { x: 200, width: 100 },
    { x: 400, width: 100 },
  ];
  assert.deepEqual(packAbove(boxes, 8), [0, 0, 0]);
});

test("above: overlapping groups push right to clear (left-to-right sweep)", () => {
  // Two 100-wide groups 60 apart: edges overlap; the right one nudges to clear.
  const boxes: AboveBox[] = [
    { x: 0, width: 100 },
    { x: 60, width: 100 },
  ];
  // prevRight = 0 + 50 + 8 = 58; curLeft = 60 - 50 = 10; nudge = 58 - 10 = 48.
  assert.deepEqual(packAbove(boxes, 8), [0, 48]);
});

test("above: a nudge cascades — each push shifts the running right edge", () => {
  const boxes: AboveBox[] = [
    { x: 0, width: 100 },
    { x: 60, width: 100 }, // → nudged to clear #0
    { x: 120, width: 100 }, // → must clear #1's *nudged* right edge, not its true x
  ];
  const nudges = packAbove(boxes, 8);
  assert.equal(nudges[0], 0);
  assert.equal(nudges[1], 48); // as above
  // prevRight = (60 + 48) + 50 + 8 = 166; curLeft = 120 - 50 = 70; nudge = 96.
  assert.equal(nudges[2], 96);
});

test("above: nudges are aligned to input order, not sweep order", () => {
  // Index 0 sits to the right of index 1; the sweep orders by x but results map back.
  const boxes: AboveBox[] = [
    { x: 60, width: 100 },
    { x: 0, width: 100 },
  ];
  const nudges = packAbove(boxes, 8);
  assert.equal(nudges[1], 0); // leftmost (index 1) is the anchor
  assert.equal(nudges[0], 48); // index 0, pushed right
});

test("above: empty input → empty nudges", () => {
  assert.deepEqual(packAbove([], 8), []);
});
