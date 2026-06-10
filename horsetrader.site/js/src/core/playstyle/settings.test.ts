import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizePlayStyleSettings,
  playStyleSettingsForPreset,
  samePlayStyleSettings,
} from "./settings.ts";

test("preset settings define the persisted assumption defaults", () => {
  assert.deepEqual(playStyleSettingsForPreset("casual"), {
    weeklyPlay: "fourDays",
    teamTrials: "rank5",
    legendRaces: "one",
    missions: "some",
    specialMissions: "welfare",
    storyEvents: "welfare",
    championsMeeting: "groupBContender",
    shopTickets: "none",
  });
  assert.deepEqual(playStyleSettingsForPreset("focused"), {
    weeklyPlay: "sixDays",
    teamTrials: "rank55",
    legendRaces: "allPartial",
    missions: "most",
    specialMissions: "major",
    storyEvents: "major",
    championsMeeting: "groupBWinner",
    shopTickets: "cleats",
  });
  assert.equal(playStyleSettingsForPreset("dedicated").legendRaces, "allFull");
});

test("normalizes stored settings against a fallback", () => {
  const fallback = playStyleSettingsForPreset("focused");
  const normalized = normalizePlayStyleSettings(
    {
      weeklyPlay: "sevenDays",
      teamTrials: "rank6",
      legendRaces: "none",
      missions: "all",
      specialMissions: "all",
      storyEvents: "earlyAchievement",
      championsMeeting: "groupAChampion",
      shopTickets: "rainbow",
    },
    fallback,
  );

  assert.deepEqual(normalized, {
    weeklyPlay: "sevenDays",
    teamTrials: "rank6",
    legendRaces: "none",
    missions: "all",
    specialMissions: "all",
    storyEvents: "earlyAchievement",
    championsMeeting: "groupAChampion",
    shopTickets: "rainbow",
  });
  assert.deepEqual(normalizePlayStyleSettings({ legendRaces: "oops" }, fallback), fallback);
  assert.deepEqual(normalizePlayStyleSettings(null, fallback), fallback);
});

test("compares persisted playstyle settings by value", () => {
  const focused = playStyleSettingsForPreset("focused");
  assert.equal(samePlayStyleSettings(focused, { ...focused }), true);
  assert.equal(samePlayStyleSettings(focused, { ...focused, missions: "all" }), false);
});
