import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveClubRank, DEFAULT_CLUB_RANK } from "./clubrank.ts";

test("resolves the configured club rank out of config.identity", () => {
  assert.equal(resolveClubRank({ identity: { clubRank: "SS" } }), "SS");
  assert.equal(resolveClubRank({ identity: { clubRank: "D+" } }), "D+");
});

test("falls back to the default tier when absent or malformed", () => {
  assert.equal(resolveClubRank(undefined), DEFAULT_CLUB_RANK);
  assert.equal(resolveClubRank({}), DEFAULT_CLUB_RANK);
  assert.equal(resolveClubRank({ identity: {} }), DEFAULT_CLUB_RANK);
  assert.equal(resolveClubRank({ identity: { clubRank: "Platinum" } }), DEFAULT_CLUB_RANK);
  assert.equal(resolveClubRank({ identity: { clubRank: 5 } }), DEFAULT_CLUB_RANK);
  assert.equal(resolveClubRank({ identity: "nope" }), DEFAULT_CLUB_RANK);
});

test("the default tier is the trainer sheet's placeholder (B+) for now", () => {
  assert.equal(DEFAULT_CLUB_RANK, "B+");
});
