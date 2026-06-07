import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizePlayStyleSettings,
  playStyleSettingsForPreset,
  samePlayStyleSettings,
} from "./playStyleSettings.ts";

test("preset settings define the persisted assumption defaults", () => {
  assert.deepEqual(playStyleSettingsForPreset("casual"), { legendRaces: "one" });
  assert.deepEqual(playStyleSettingsForPreset("focused"), { legendRaces: "allPartial" });
  assert.deepEqual(playStyleSettingsForPreset("dedicated"), { legendRaces: "allFull" });
});

test("normalizes stored settings against a fallback", () => {
  const fallback = playStyleSettingsForPreset("focused");

  assert.deepEqual(normalizePlayStyleSettings({ legendRaces: "none" }, fallback), { legendRaces: "none" });
  assert.deepEqual(normalizePlayStyleSettings({ legendRaces: "oops" }, fallback), fallback);
  assert.deepEqual(normalizePlayStyleSettings(null, fallback), fallback);
});

test("compares persisted playstyle settings by value", () => {
  assert.equal(samePlayStyleSettings({ legendRaces: "one" }, { legendRaces: "one" }), true);
  assert.equal(samePlayStyleSettings({ legendRaces: "one" }, { legendRaces: "allFull" }), false);
});
