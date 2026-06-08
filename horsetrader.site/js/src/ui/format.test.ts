import { test } from "node:test";
import assert from "node:assert/strict";

import { formatBalance, formatDate, formatDelta, formatRewardLines } from "./format.ts";

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

test("reward lines are labeled and ordered for the timeline card chin", () => {
  assert.deepEqual(
    formatRewardLines({
      support_tickets: 2,
      gold_crystal_shards: 3,
      free_carats: 1500,
      rainbow_crystal_shards: 3,
      trainee_tickets: 1,
    }),
    [
      { key: "free_carats", amount: "1,500", label: "carats", icon: "/icons/carat.png" },
      { key: "trainee_tickets", amount: "1", label: "trainee tickets", icon: "/icons/trainee_ticket.png" },
      { key: "support_tickets", amount: "2", label: "support tickets", icon: "/icons/support_ticket.png" },
      { key: "rainbow_crystal_shards", amount: "3", label: "rainbow shards", icon: "/icons/rainbow_crystal_shard.png" },
      { key: "gold_crystal_shards", amount: "3", label: "gold shards", icon: "/icons/gold_crystal_shard.png" },
    ],
  );
});

test("reward lines skip zeroes and keep unknown reward keys readable", () => {
  assert.deepEqual(formatRewardLines({ free_carats: 0, club_coins: 12 }), [{ key: "club_coins", amount: "12", label: "club coins" }]);
});
