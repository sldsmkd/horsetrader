/**
 * The packer: the one genuinely algorithmic module of the UI (ui.md principle 8,
 * docs/frontend/interaction.md build-order 4e). It is **contained** here as pure
 * geometry — `(x-positions, heights) → y-offsets` — never sprinkled as
 * `getBoundingClientRect` calls across views (the prototype's sprawl). The view
 * renders cards, measures heights *once*, calls this, and applies the result as
 * transforms; the stems stay pinned to the true-date x (principle 4 — the UI
 * deforms before it lies about *when*).
 *
 * Pure and DOM-free, so it is core-grade testable (`pack.test.ts`). It is **one
 * module with two lane strategies** — the asymmetry is correct, different
 * semantics and different data (ui.md). This file holds the **below-lane**
 * strategy; the above-lane group-and-nudge follows separately.
 */

/** One card to place: its true-date centre x and its measured width/height (content px). */
export interface Box {
  /** Content-space centre x (off the shared axis) — the card's true date, never moved. */
  x: number;
  /** Collision-footprint width in px. Cards come in unit multiples (1u = 140px: a
   *  compact card is 1u, a full card 2u), so a 1u card only fights for the room it
   *  actually occupies — not a uniform full-width footprint. */
  width: number;
  /** Measured card height in px. */
  height: number;
}

/** The spacing that defines collisions. All in content-space px. */
export interface BelowConfig {
  /** Minimum horizontal breathing room between neighbouring cards. */
  gapX: number;
  /** Vertical gap between two cards stacked in the same column. */
  gapY: number;
}

/**
 * Below-lane vertical collision-stacking. Below the line is the income axis: each
 * card is a single atom on its own true date, and the lane grows **downward** from
 * the line. Cards that x-overlap can't share a row, so they stack; the returned
 * y-offset is how far below the line each card drops (0 = flush against it).
 *
 * **Tallest-first, fill the gaps.** We place the tallest cards first so they land
 * at offset 0 against the line and the shorter ones tuck into the gaps around
 * them, rather than a tall card arriving late and shoving a whole column down.
 * Each card takes the **smallest** offset that clears every already-placed card it
 * x-overlaps — so a short card slides up beside a tall neighbour whenever it fits.
 *
 * Returns offsets **aligned to the input order** (`boxes[i] → offsets[i]`), so the
 * caller zips them straight back onto its cards.
 */
export function packBelow(boxes: readonly Box[], { gapX, gapY }: BelowConfig): number[] {
  // Placement priority — the one tuning knob. Tallest-first today (big cards
  // anchor the line, small ones fill the gaps); could become fattest-loot-first
  // or another key without touching the geometry below. x then index break ties
  // so the result is deterministic.
  const order = boxes.map((_, i) => i);
  order.sort((a, b) => boxes[b].height - boxes[a].height || boxes[a].x - boxes[b].x || a - b);

  const offsets = new Array<number>(boxes.length);
  const placed: number[] = []; // input-indices already given an offset, in placement order

  // Two cards share a column (and so can vertically collide) when their centres
  // are nearer than their two half-widths plus the gap — so a slim card beside a
  // wide one only collides over the room they genuinely share.
  const xCollides = (a: number, b: number) =>
    Math.abs(boxes[a].x - boxes[b].x) < (boxes[a].width + boxes[b].width) / 2 + gapX;
  // `cur` at `yOff` clears `prev` when one sits entirely above the other (+ gapY).
  const clears = (cur: number, yOff: number, prev: number) =>
    yOff + boxes[cur].height + gapY <= offsets[prev] || yOff >= offsets[prev] + boxes[prev].height + gapY;

  for (const cur of order) {
    const blockers = placed.filter((prev) => xCollides(cur, prev));
    if (blockers.length === 0) {
      offsets[cur] = 0;
    } else {
      // The candidate offsets are 0 and "just below" each blocker; take the
      // lowest that clears them all (a real gap, not just the bottom of the pile).
      const candidates = [0, ...blockers.map((prev) => offsets[prev] + boxes[prev].height + gapY)].sort((a, b) => a - b);
      offsets[cur] = candidates.find((y) => blockers.every((prev) => clears(cur, y, prev))) ?? candidates[candidates.length - 1];
    }
    placed.push(cur);
  }

  return offsets;
}

/** One above-lane group to place: its true-date centre x and its measured width. */
export interface AboveBox {
  /** Content-space centre x (off the axis) — the group's shared start, never moved. */
  x: number;
  /** Measured group width in px. */
  width: number;
}

/**
 * Above-lane horizontal nudge. Above the line is the appearance axis: banner
 * *groups* (banners sharing a start) sit at their true date. Where neighbours
 * would overlap, a left-to-right sweep pushes each group **right** just enough to
 * clear the one before it (plus `gap`) — bodies drift right under crowding while
 * their stems stay pinned to the true tick (principle 4).
 *
 * Returns nudges **aligned to input order** (`boxes[i] → nudges[i]`); the caller
 * applies each as a translateX on the group body. Boxes are centred on `x`.
 */
export function packAbove(boxes: readonly AboveBox[], gap: number): number[] {
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a].x - boxes[b].x);
  const nudges = new Array<number>(boxes.length).fill(0);

  for (let k = 1; k < order.length; k++) {
    const cur = order[k];
    const prev = order[k - 1];
    const prevRight = boxes[prev].x + nudges[prev] + boxes[prev].width / 2 + gap;
    const curLeft = boxes[cur].x + nudges[cur] - boxes[cur].width / 2;
    if (curLeft < prevRight) nudges[cur] += prevRight - curLeft;
  }

  return nudges;
}
