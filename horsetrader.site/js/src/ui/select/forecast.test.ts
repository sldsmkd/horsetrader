import { test } from "node:test";
import assert from "node:assert/strict";

import { forecast, expectedCopies, type ForecastInput } from "./forecast.ts";

const BASE: Omit<ForecastInput, "pity"> = { pullsPerPity: 200, featuredRate: 0.0075, maxCopies: 5 };

/** A distribution is always maxCopies+1 bars and is a proper pmf (sums to 1). */
function assertProperPmf(bars: ReturnType<typeof forecast>): void {
  assert.equal(bars.length, BASE.maxCopies + 1);
  const total = bars.reduce((s, b) => s + b.prob, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `pmf sums to ${total}`);
  for (const b of bars) assert.ok(b.prob >= -1e-12 && b.prob <= 1 + 1e-12, `prob in range: ${b.prob}`);
}

test("pity 0: no plan — all mass on zero copies, nothing guaranteed", () => {
  const bars = forecast({ ...BASE, pity: 0 });
  assertProperPmf(bars);
  assert.equal(bars[0].prob, 1);
  assert.ok(bars.every((b) => !b.guaranteed));
});

test("any pity floors the outcome: P(0 copies) is exactly 0 once committed", () => {
  const bars = forecast({ ...BASE, pity: 1 });
  assertProperPmf(bars);
  assert.equal(bars[0].prob, 0);
  // 1 copy is the spark floor — guaranteed, but with ~1.5 expected extras over 200
  // pulls the bare floor (P(0 extras) = 0.9925^200 ≈ 0.222) is not even the mode.
  assert.ok(bars[1].guaranteed);
  assert.ok(Math.abs(bars[1].prob - Math.pow(1 - 0.0075, 200)) < 1e-9);
});

test("the spark floor shifts the whole distribution right", () => {
  const bars = forecast({ ...BASE, pity: 2 });
  assertProperPmf(bars);
  assert.equal(bars[0].prob, 0);
  assert.equal(bars[1].prob, 0); // can't end below 2 with 2 pity committed
  assert.ok(bars[2].guaranteed && bars[3].guaranteed === false);
});

test("pity at/above the cap guarantees MLB — all mass on the top bar", () => {
  for (const pity of [5, 7]) {
    const bars = forecast({ ...BASE, pity });
    assertProperPmf(bars);
    assert.equal(bars[5].prob, 1);
    assert.ok(bars.slice(0, 5).every((b) => b.prob === 0));
  }
});

test("the random-extras bar matches the binomial directly", () => {
  // pity 1 → N=200 pulls, P(exactly 1 extra) = C(200,1)·p·(1-p)^199 lands on bar[2].
  const p = 0.0075;
  const expected = 200 * p * Math.pow(1 - p, 199);
  const bars = forecast({ ...BASE, pity: 1 });
  assert.ok(Math.abs(bars[2].prob - expected) < 1e-9);
});

test("expectedCopies is at least the committed pity (the guaranteed floor)", () => {
  assert.ok(expectedCopies({ ...BASE, pity: 1 }) > 1);
  assert.ok(expectedCopies({ ...BASE, pity: 3 }) > 3);
  assert.equal(expectedCopies({ ...BASE, pity: 0 }), 0);
});

test("a fat custom rate pushes mass into extra copies", () => {
  // twin-turbo's 0.1 override: with one spark, extras are very likely.
  const bars = forecast({ ...BASE, pity: 1, featuredRate: 0.1 });
  assertProperPmf(bars);
  assert.ok(bars[1].prob < 0.5, "the bare floor is now unlikely");
  assert.ok(bars[5].prob > 0.1, "the MLB tail is fat at 200 pulls × 10%");
});
