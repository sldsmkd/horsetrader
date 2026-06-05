import { test } from "node:test";
import assert from "node:assert/strict";

import { formatBalance, formatDate, formatDelta } from "./format.ts";

test("a balance is grouped, with a minus only when negative", () => {
  assert.equal(formatBalance(1250), "1,250");
  assert.equal(formatBalance(1234567), "1,234,567");
  assert.equal(formatBalance(-50), "-50");
  assert.equal(formatBalance(0), "0");
});

test("a delta always carries its sign — and a negative is never double-signed", () => {
  assert.equal(formatDelta(75), "+75");
  assert.equal(formatDelta(1250), "+1,250");
  assert.equal(formatDelta(-50), "-50"); // the prototype's `+-50` bug, pinned shut
  assert.equal(formatDelta(0), "0");
});

test("large magnitudes keep grouping and sign semantics", () => {
  assert.equal(formatBalance(1_000_000_000), "1,000,000,000");
  assert.equal(formatDelta(1_000_000_000), "+1,000,000,000");
  assert.equal(formatDelta(-1_000_000_000), "-1,000,000,000");
});

test("date labels are stable UTC day labels", () => {
  assert.equal(formatDate("2026-06-10"), "Jun 10, 26");
  assert.equal(formatDate("2024-02-29"), "Feb 29, 24");
});
