import assert from "node:assert/strict";
import test from "node:test";

import { playStyleSettingsForPreset } from "../../../core/playstyle/index.ts";
import {
  PLAY_STYLE_SECTIONS,
  playStyleDecisionCount,
  withPlayStyleSetting,
} from "./playStyleSettingsModel.ts";

test("shared play-style sections preserve the full decision inventory", () => {
  assert.deepEqual(
    PLAY_STYLE_SECTIONS.map((section) => [section.title, playStyleDecisionCount(section)]),
    [
      ["PARTICIPATE", 9],
      ["ENGAGE", 4],
      ["CHALLENGE", 3],
      ["COMPETE", 3],
    ],
  );
});

test("a staged setting update is immutable", () => {
  const before = playStyleSettingsForPreset("focused");
  const after = withPlayStyleSetting(before, "dailies", before.dailies === "on" ? "off" : "on");

  assert.notEqual(after, before);
  assert.notEqual(after.dailies, before.dailies);
  assert.equal(after.teamTrials, before.teamTrials);
});
