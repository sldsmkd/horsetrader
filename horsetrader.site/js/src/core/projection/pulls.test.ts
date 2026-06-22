import { test } from "node:test";
import assert from "node:assert/strict";

import { pullCapacity, spend, remainingAfterSpend, remainingCapacityAfterSpend, commitmentStatus, bannerDays, type PullSources, type PullCaps } from "./pulls.ts";

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

test("pullCapacity: negative account-state balances are not available pulls", () => {
  const cap = pullCapacity({ freePulls: 2, tickets: -4, freeCarats: -150, paidCarats: -50 }, CAPS);
  assert.deepEqual(cap, { freePulls: 2, tickets: 0, dailyPaid: 0, freeCaratPulls: 0, total: 2 });
});

test("bannerDays is the whole-day span, at least 1", () => {
  assert.equal(bannerDays("2026-06-10", "2026-06-16"), 6);
  assert.equal(bannerDays("2026-07-20T22:00:00+00:00", "2026-08-08T22:00:00+00:00"), 19);
  assert.equal(bannerDays("2026-06-10", "2026-06-10"), 1); // same-day still gives one window
});

test("spend: nothing at zero pity", () => {
  assert.deepEqual(spend({ freePulls: 5, tickets: 5, freeCarats: 9000, paidCarats: 600 }, CAPS, 200, 0, false), { freeCarats: 0, paidCarats: 0, tickets: 0 });
});

test("spend: cost-ascending — free pulls, tickets, daily paid, then free carats", () => {
  // 12-day caps. 2 pity = 400 pulls: 10 free pulls + 30 tickets = 40 → 360 left; daily
  // paid min(12, ⌊600/50⌋=12) = 12 pulls (600 paid), 348 left → 348 × 150 free carats.
  const d = spend({ freePulls: 10, tickets: 30, freeCarats: 100000, paidCarats: 600 }, CAPS, 200, 2, false);
  assert.deepEqual(d, { freeCarats: 348 * 150, paidCarats: 600, tickets: 30 });
});

test("spend: overcommit — free carats consumed past what's available (caller goes negative)", () => {
  const d = spend({ freePulls: 0, tickets: 0, freeCarats: 1500, paidCarats: 0 }, { caratsPerPull: 150, paidDailyPull: 50, bannerDays: 6 }, 200, 1, false);
  assert.equal(d.freeCarats, 200 * 150); // 30,000 spent against 1,500 available
});

test("spend: paid carats only leave through the daily window — the rest banks", () => {
  // 5000 paid on a 6-day banner → 6 daily pulls (300 paid); the other 4,700 never spends.
  const d = spend({ freePulls: 0, tickets: 0, freeCarats: 0, paidCarats: 5000 }, { caratsPerPull: 150, paidDailyPull: 50, bannerDays: 6 }, 200, 1, false);
  assert.equal(d.paidCarats, 300);
});

test("spend with usePaid: leftover paid pays full price after the daily window, then free surges", () => {
  // Same scenario as the bank test above, but usePaid on. 1 pity = 200 pulls.
  // Daily window: 6 pulls (300 paid). Free carats: 0. Remaining paid 4,700 pays full
  // price: ⌊4700/150⌋ = 31 pulls (4,650 paid, 50 banks). Still 163 short → free surges
  // negative for 163 × 150.
  const d = spend({ freePulls: 0, tickets: 0, freeCarats: 0, paidCarats: 5000 }, { caratsPerPull: 150, paidDailyPull: 50, bannerDays: 6 }, 200, 1, true);
  assert.deepEqual(d, { freeCarats: 163 * 150, paidCarats: 300 + 31 * 150, tickets: 0 });
});

test("spend with usePaid: free burns to its < 150 remainder, paid covers the rest, no surge", () => {
  // 10 pulls needed. Daily window: 1 pull (50 paid). Free 460 → 3 full pulls (450 spent,
  // 10 remainder left, NOT negative). Paid covers the last 6 at full price (900). No surge.
  const sources = { freePulls: 0, tickets: 0, freeCarats: 460, paidCarats: 2000 };
  const caps = { caratsPerPull: 150, paidDailyPull: 50, bannerDays: 1 };
  assert.deepEqual(spend(sources, caps, 10, 1, true), { freeCarats: 450, paidCarats: 50 + 900, tickets: 0 });
  // Free floored at its remainder rather than going negative.
  assert.equal(remainingAfterSpend(sources, caps, 10, 1, true).freeCarats, 10);
});

test("remainingAfterSpend: reports resource balances after the reservation", () => {
  const after = remainingAfterSpend({ freePulls: 10, tickets: 30, freeCarats: 100000, paidCarats: 600 }, CAPS, 200, 2, false);
  assert.deepEqual(after, { freePulls: 0, tickets: 0, freeCarats: 47800, paidCarats: 0 });
});

test("remainingCapacityAfterSpend: own commitment consumes sources but available pulls floor at zero", () => {
  const sources = { freePulls: 60, tickets: 8, freeCarats: 0, paidCarats: 950 };
  const caps = { caratsPerPull: 150, paidDailyPull: 50, bannerDays: 19 };

  // 1 pity consumes 60 gifts + 8 tickets + 19 paid pulls, then overcommits free
  // carats. The resource balance can go negative; the card's available-pull read cannot.
  assert.deepEqual(remainingAfterSpend(sources, caps, 200, 1, false), { freePulls: 0, tickets: 0, freeCarats: -16950, paidCarats: 0 });
  assert.deepEqual(remainingCapacityAfterSpend(sources, caps, 200, 1, false), { freePulls: 0, tickets: 0, dailyPaid: 0, freeCaratPulls: 0, total: 0 });
});

const GACHA = { caratsPerPull: 150, paidDailyPull: 50, sparkThreshold: 200 };

test("commitmentStatus: assembles kind-narrowed sources, fundable with capacity left over", () => {
  // Support banner → support tickets; balance comfortably covers a 2-pity (400 pull)
  // commitment, leaving 47,800 free carats → ⌊47800/150⌋ = 318 pulls of headroom.
  const status = commitmentStatus("support", 10, "2026-06-10", "2026-06-22", { free_carats: 100000, paid_carats: 600, support_tickets: 30 }, GACHA, 2, false);
  assert.equal(status.kind, "support");
  assert.equal(status.pity, 2);
  assert.equal(status.unfundable, false);
  assert.equal(status.capacity.total, 318);
  assert.equal(status.capacity.freeCaratPulls, 318);
});

test("commitmentStatus: flags unfundable when the reservation drives free carats negative", () => {
  // 1 pity = 200 pulls; 60 gifts + 8 tickets + 19 daily paid fall far short, so free
  // carats surge negative → unfundable, and no capacity remains.
  const status = commitmentStatus("trainee", 60, "2026-07-20T22:00:00+00:00", "2026-08-08T22:00:00+00:00", { free_carats: 0, paid_carats: 950, trainee_tickets: 8 }, GACHA, 1, false);
  assert.equal(status.unfundable, true);
  assert.equal(status.capacity.total, 0);
});
