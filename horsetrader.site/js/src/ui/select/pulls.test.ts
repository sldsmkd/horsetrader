import { test } from "node:test";
import assert from "node:assert/strict";

import { pullCapacity, bannerDays, type PullSources, type PullCaps } from "./pulls.ts";

const CAPS: PullCaps = { caratsPerPull: 150, paidDailyPull: 50, bannerDays: 12 };
const EMPTY: PullSources = { freePulls: 0, tickets: 0, freeCarats: 0, paidCarats: 0 };

test("free pulls and tickets are each one pull, counted straight", () => {
  const cap = pullCapacity({ ...EMPTY, freePulls: 3, tickets: 5 }, CAPS);
  assert.deepEqual(cap, { freePulls: 3, tickets: 5, dailyPaid: 0, freeCaratPulls: 0, total: 8 });
});

test("free carats convert at the full 150 rate, floored", () => {
  const cap = pullCapacity({ ...EMPTY, freeCarats: 1000 }, CAPS); // ⌊1000/150⌋ = 6
  assert.equal(cap.freeCaratPulls, 6);
  assert.equal(cap.total, 6);
});

test("daily paid pulls: capped by carats when carats run out first", () => {
  // 500 paid / 50 = 10 daily pulls; the 12-day run allows 12, so carats bind → 10.
  const cap = pullCapacity({ ...EMPTY, paidCarats: 500 }, CAPS);
  assert.equal(cap.dailyPaid, 10);
});

test("daily paid pulls: capped by duration when days run out first", () => {
  // 5000 paid / 50 = 100 possible, but a 12-day banner only opens 12 windows → 12.
  const cap = pullCapacity({ ...EMPTY, paidCarats: 5000 }, CAPS);
  assert.equal(cap.dailyPaid, 12);
});

test("paid carats the daily cap can't absorb do NOT count as available pulls", () => {
  // 5000 paid on a 12-day banner → only 12 daily pulls (600 carats' worth); the rest is
  // banked, never converted at 150. Same paid carats yield far fewer pulls than free.
  const paid = pullCapacity({ ...EMPTY, paidCarats: 5000 }, CAPS);
  const free = pullCapacity({ ...EMPTY, freeCarats: 5000 }, CAPS); // ⌊5000/150⌋ = 33
  assert.equal(paid.total, 12);
  assert.equal(free.total, 33);
});

test("duration is a pull-math input: a longer banner extracts more from the same paid carats", () => {
  const src = { ...EMPTY, paidCarats: 5000 };
  const short = pullCapacity(src, { ...CAPS, bannerDays: 6 });
  const long = pullCapacity(src, { ...CAPS, bannerDays: 20 });
  assert.equal(short.dailyPaid, 6);
  assert.equal(long.dailyPaid, 20);
});

test("total is the sum across all four sources", () => {
  const cap = pullCapacity({ freePulls: 2, tickets: 3, freeCarats: 1000, paidCarats: 500 }, CAPS);
  // 2 + 3 + ⌊500/50⌋=10 + ⌊1000/150⌋=6
  assert.equal(cap.total, 21);
});

test("bannerDays is the whole-day span, at least 1", () => {
  assert.equal(bannerDays("2026-06-10", "2026-06-16"), 6);
  assert.equal(bannerDays("2026-07-20T22:00:00+00:00", "2026-08-08T22:00:00+00:00"), 19);
  assert.equal(bannerDays("2026-06-10", "2026-06-10"), 1); // same-day still gives one window
});
