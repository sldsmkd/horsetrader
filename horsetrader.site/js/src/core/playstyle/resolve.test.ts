import { test } from "node:test";
import assert from "node:assert/strict";

import { resolvePlayStyle } from "./resolve.ts";
import { playStyleSettingsForPreset } from "./settings.ts";

test("absent config resolves to the default preset", () => {
  assert.deepEqual(resolvePlayStyle(undefined), {
    key: "focused",
    settings: playStyleSettingsForPreset("focused"),
  });
  assert.deepEqual(resolvePlayStyle({}), {
    key: "focused",
    settings: playStyleSettingsForPreset("focused"),
  });
});

test("a stored preset key seeds its defaults, then stored settings override", () => {
  const resolved = resolvePlayStyle({
    identity: { playStyleKey: "dedicated", playStyleSettings: { championsMeeting: "off" } },
  });
  assert.equal(resolved.key, "dedicated");
  // unset fields fall back to the dedicated preset; the stored one wins
  assert.equal(resolved.settings.championsMeeting, "off");
  assert.equal(resolved.settings.teamTrials, "rank60");
});

test("a malformed preset key falls back to default but keeps valid settings", () => {
  const resolved = resolvePlayStyle({ identity: { playStyleKey: "bogus", playStyleSettings: { missions: "on" } } });
  assert.equal(resolved.key, "focused");
  assert.equal(resolved.settings.missions, "on");
});
