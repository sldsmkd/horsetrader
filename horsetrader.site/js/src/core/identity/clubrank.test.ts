import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveClub, DEFAULT_CLUB_RANK } from "./clubrank.ts";

test("resolves the club membership out of config.identity", () => {
  assert.deepEqual(resolveClub({ identity: { clubName: "UmaDen", clubRank: "SS" } }), { name: "UmaDen", rank: "SS" });
  assert.deepEqual(resolveClub({ identity: { clubName: "UmaDen", clubRank: "D+" } }), { name: "UmaDen", rank: "D+" });
});

test("trims the club name and a non-empty name is membership", () => {
  assert.deepEqual(resolveClub({ identity: { clubName: "  Spica  ", clubRank: "A" } }), { name: "Spica", rank: "A" });
});

test("in a club, an absent or malformed rank falls back to the default tier", () => {
  assert.deepEqual(resolveClub({ identity: { clubName: "UmaDen" } }), { name: "UmaDen", rank: DEFAULT_CLUB_RANK });
  assert.deepEqual(resolveClub({ identity: { clubName: "UmaDen", clubRank: "Platinum" } }), {
    name: "UmaDen",
    rank: DEFAULT_CLUB_RANK,
  });
  assert.deepEqual(resolveClub({ identity: { clubName: "UmaDen", clubRank: 5 } }), { name: "UmaDen", rank: DEFAULT_CLUB_RANK });
});

test("no club (absent or blank name) resolves to null — no membership, no income", () => {
  assert.equal(resolveClub(undefined), null);
  assert.equal(resolveClub({}), null);
  assert.equal(resolveClub({ identity: {} }), null);
  assert.equal(resolveClub({ identity: { clubName: "" } }), null);
  assert.equal(resolveClub({ identity: { clubName: "   " } }), null);
  assert.equal(resolveClub({ identity: { clubRank: "SS" } }), null);
  assert.equal(resolveClub({ identity: "nope" }), null);
});
