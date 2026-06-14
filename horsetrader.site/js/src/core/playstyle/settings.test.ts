import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizePlayStyleSettings,
  playStyleSettingsForPreset,
  samePlayStyleSettings,
} from "./settings.ts";

test("preset settings define the persisted assumption defaults", () => {
  assert.deepEqual(playStyleSettingsForPreset("sweetie"), {
    dailies: "on",
    weeklyLogin: "on",
    teamTrials: "rank45",
    anniversaryMissions: "on",
    holidays: "on",
    scenarioMissions: "on",
    traineeDebuts: "on",
    factorStudies: "off",
    racingCarnival: "off",
    showtime: "off",
    missions: "off",
    storyEvents: "tier1",
    championsMeeting: "off",
    shopTickets: "none",
    leagueOfHeroes: "off",
    strongestTeam: "off",
    legendRaces: "off",
    skillTests: "off",
    masters: "off",
  });
  assert.deepEqual(playStyleSettingsForPreset("casual"), {
    dailies: "on",
    weeklyLogin: "on",
    teamTrials: "rank50",
    anniversaryMissions: "on",
    holidays: "on",
    scenarioMissions: "on",
    traineeDebuts: "on",
    factorStudies: "off",
    racingCarnival: "off",
    showtime: "off",
    missions: "off",
    storyEvents: "tier2",
    championsMeeting: "groupBContender",
    shopTickets: "cleats",
    leagueOfHeroes: "gold2",
    strongestTeam: "C",
    legendRaces: "off",
    skillTests: "off",
    masters: "1",
  });
  assert.deepEqual(playStyleSettingsForPreset("focused"), {
    dailies: "on",
    weeklyLogin: "on",
    teamTrials: "rank55",
    anniversaryMissions: "on",
    holidays: "on",
    scenarioMissions: "on",
    traineeDebuts: "on",
    factorStudies: "on",
    racingCarnival: "on",
    showtime: "on",
    missions: "off",
    storyEvents: "tier3",
    championsMeeting: "groupBWinner",
    shopTickets: "cleats",
    leagueOfHeroes: "gold4",
    strongestTeam: "A",
    legendRaces: "on",
    skillTests: "off",
    masters: "2",
  });
  assert.deepEqual(playStyleSettingsForPreset("dedicated"), {
    dailies: "on",
    weeklyLogin: "on",
    teamTrials: "rank60",
    anniversaryMissions: "on",
    holidays: "on",
    scenarioMissions: "on",
    traineeDebuts: "on",
    factorStudies: "on",
    racingCarnival: "on",
    showtime: "on",
    missions: "on",
    storyEvents: "tier4",
    championsMeeting: "groupARunnerUp",
    shopTickets: "friendPoints",
    leagueOfHeroes: "platinum1",
    strongestTeam: "S",
    legendRaces: "on",
    skillTests: "on",
    masters: "3",
  });
  assert.deepEqual(playStyleSettingsForPreset("unhinged"), {
    dailies: "on",
    weeklyLogin: "on",
    teamTrials: "rank60",
    anniversaryMissions: "on",
    holidays: "on",
    scenarioMissions: "on",
    traineeDebuts: "on",
    factorStudies: "on",
    racingCarnival: "on",
    showtime: "on",
    missions: "on",
    storyEvents: "tier4",
    championsMeeting: "groupAChampion",
    shopTickets: "rainbow",
    leagueOfHeroes: "platinum2",
    strongestTeam: "SS",
    legendRaces: "on",
    skillTests: "on",
    masters: "EX",
  });
  // Custom has no canonical defaults; the fallback backstop is the default preset.
  assert.deepEqual(playStyleSettingsForPreset("custom"), playStyleSettingsForPreset("focused"));
});

test("normalizes stored settings against a fallback", () => {
  const fallback = playStyleSettingsForPreset("focused");
  const normalized = normalizePlayStyleSettings(
    {
      dailies: "on",
      weeklyLogin: "off",
      teamTrials: "rank60",
      anniversaryMissions: "yes",
      holidays: "off",
      scenarioMissions: "on",
      traineeDebuts: "no",
      factorStudies: "off",
      racingCarnival: "yes",
      showtime: "on",
      missions: "yes",
      storyEvents: "off",
      championsMeeting: "groupAChampion",
      shopTickets: "rainbow",
      leagueOfHeroes: "platinum4",
      strongestTeam: "SS",
      legendRaces: "yes",
      skillTests: "on",
      masters: "EX",
    },
    fallback,
  );

  assert.deepEqual(normalized, {
    dailies: "on",
    weeklyLogin: "off",
    teamTrials: "rank60",
    anniversaryMissions: "on",
    holidays: "off",
    scenarioMissions: "on",
    traineeDebuts: "off",
    factorStudies: "off",
    racingCarnival: "on",
    showtime: "on",
    missions: "on",
    storyEvents: "tier0",
    championsMeeting: "groupAChampion",
    shopTickets: "rainbow",
    leagueOfHeroes: "platinum4",
    strongestTeam: "SS",
    legendRaces: "on",
    skillTests: "on",
    masters: "EX",
  });
  assert.deepEqual(normalizePlayStyleSettings({ teamTrials: "oops" }, fallback), fallback);
  assert.deepEqual(normalizePlayStyleSettings(null, fallback), fallback);
});

test("compares persisted playstyle settings by value", () => {
  const focused = playStyleSettingsForPreset("focused");
  assert.equal(samePlayStyleSettings(focused, { ...focused }), true);
  assert.equal(samePlayStyleSettings(focused, { ...focused, missions: "on" }), false);
});
