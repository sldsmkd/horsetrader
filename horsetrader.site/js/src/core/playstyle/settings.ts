/**
 * The per-stream play-style assumptions: the engagement level the player picks
 * for each income stream (dailies, weekly login, Team Trials rank, …). These are *gating
 * choices* the projection's income channels resolve against baked reward tables —
 * never game-data values (docs/frontend/projection.md, docs/frontend/glue.md).
 * A preset seeds a full set; Custom edits them freely.
 */

import type { PlayStyleKey } from "./keys.ts";

export const PLAY_TOGGLE_KEYS = ["off", "on"] as const;
export const TEAM_TRIAL_KEYS = [
  "rank20",
  "rank25",
  "rank30",
  "rank35",
  "rank40",
  "rank45",
  "rank50",
  "rank55",
  "rank60",
] as const;
// Minor beats are event participation gates. Each is binary: the player either
// engages with the schedule-card event/missions or leaves that event family out.
export const MISSION_KEYS = PLAY_TOGGLE_KEYS;
export const CHAMPIONS_MEETING_KEYS = ["off", "groupBContender", "groupBWinner", "groupARunnerUp", "groupAChampion"] as const;
export const SHOP_TICKET_KEYS = ["none", "cleats", "friendPoints", "rainbow"] as const;
export const LEAGUE_OF_HEROES_KEYS = ["off", "silver4", "gold1", "gold2", "gold3", "gold4", "platinum1", "platinum2", "platinum3", "platinum4"] as const;
export const STRONGEST_TEAM_KEYS = ["off", "E", "D", "C", "B", "A", "S", "SS"] as const;
export const MASTERS_KEYS = ["off", "1", "2", "3", "EX"] as const;

export type PlayToggleKey = (typeof PLAY_TOGGLE_KEYS)[number];
export type TeamTrialKey = (typeof TEAM_TRIAL_KEYS)[number];
export type MissionKey = (typeof MISSION_KEYS)[number];
export type ChampionsMeetingKey = (typeof CHAMPIONS_MEETING_KEYS)[number];
export type ShopTicketKey = (typeof SHOP_TICKET_KEYS)[number];
export type LeagueOfHeroesKey = (typeof LEAGUE_OF_HEROES_KEYS)[number];
export type StrongestTeamKey = (typeof STRONGEST_TEAM_KEYS)[number];
export type MastersKey = (typeof MASTERS_KEYS)[number];

export interface PlayStyleSettings {
  dailies: PlayToggleKey;
  weeklyLogin: PlayToggleKey;
  teamTrials: TeamTrialKey;
  anniversaryMissions: PlayToggleKey;
  holidays: PlayToggleKey;
  scenarioMissions: PlayToggleKey;
  traineeDebuts: PlayToggleKey;
  factorStudies: PlayToggleKey;
  racingCarnival: PlayToggleKey;
  showtime: PlayToggleKey;
  missions: MissionKey;
  storyEvents: PlayToggleKey;
  championsMeeting: ChampionsMeetingKey;
  shopTickets: ShopTicketKey;
  leagueOfHeroes: LeagueOfHeroesKey;
  strongestTeam: StrongestTeamKey;
  legendRaces: PlayToggleKey;
  skillTests: PlayToggleKey;
  masters: MastersKey;
}

const PRESET_SETTINGS: Record<Exclude<PlayStyleKey, "custom">, PlayStyleSettings> = {
  sweetie: {
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
    storyEvents: "on",
    championsMeeting: "off",
    shopTickets: "none",
    leagueOfHeroes: "off",
    strongestTeam: "off",
    legendRaces: "off",
    skillTests: "off",
    masters: "off",
  },
  casual: {
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
    storyEvents: "on",
    championsMeeting: "groupBContender",
    shopTickets: "cleats",
    leagueOfHeroes: "gold2",
    strongestTeam: "C",
    legendRaces: "off",
    skillTests: "off",
    masters: "3",
  },
  focused: {
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
    storyEvents: "on",
    championsMeeting: "groupBWinner",
    shopTickets: "cleats",
    leagueOfHeroes: "gold4",
    strongestTeam: "A",
    legendRaces: "on",
    skillTests: "off",
    masters: "2",
  },
  dedicated: {
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
    storyEvents: "on",
    championsMeeting: "groupARunnerUp",
    shopTickets: "friendPoints",
    leagueOfHeroes: "platinum1",
    strongestTeam: "S",
    legendRaces: "on",
    skillTests: "on",
    masters: "1",
  },
  unhinged: {
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
    storyEvents: "on",
    championsMeeting: "groupAChampion",
    shopTickets: "rainbow",
    leagueOfHeroes: "platinum2",
    strongestTeam: "SS",
    legendRaces: "on",
    skillTests: "on",
    masters: "EX",
  },
};

function isOneOf<T extends string>(value: unknown, keys: readonly T[]): value is T {
  return typeof value === "string" && (keys as readonly string[]).includes(value);
}

export function playStyleSettingsForPreset(key: PlayStyleKey): PlayStyleSettings {
  // Interim: Custom has no tuning surface, so it mirrors the ceiling preset.
  return key === "custom" ? { ...PRESET_SETTINGS.unhinged } : { ...PRESET_SETTINGS[key] };
}

function normalizeToggle(value: unknown, fallback: PlayToggleKey): PlayToggleKey {
  if (isOneOf(value, PLAY_TOGGLE_KEYS)) return value;
  if (value === "yes") return "on";
  if (value === "no") return "off";
  return fallback;
}

export function normalizePlayStyleSettings(value: unknown, fallback: PlayStyleSettings): PlayStyleSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ...fallback };
  const raw = value as Record<string, unknown>;
  return {
    dailies: isOneOf(raw["dailies"], PLAY_TOGGLE_KEYS) ? raw["dailies"] : fallback.dailies,
    weeklyLogin: isOneOf(raw["weeklyLogin"], PLAY_TOGGLE_KEYS) ? raw["weeklyLogin"] : fallback.weeklyLogin,
    teamTrials: isOneOf(raw["teamTrials"], TEAM_TRIAL_KEYS) ? raw["teamTrials"] : fallback.teamTrials,
    anniversaryMissions: normalizeToggle(raw["anniversaryMissions"], fallback.anniversaryMissions),
    holidays: normalizeToggle(raw["holidays"], fallback.holidays),
    scenarioMissions: normalizeToggle(raw["scenarioMissions"], fallback.scenarioMissions),
    traineeDebuts: normalizeToggle(raw["traineeDebuts"], fallback.traineeDebuts),
    factorStudies: normalizeToggle(raw["factorStudies"], fallback.factorStudies),
    racingCarnival: normalizeToggle(raw["racingCarnival"], fallback.racingCarnival),
    showtime: normalizeToggle(raw["showtime"], fallback.showtime),
    missions: normalizeToggle(raw["missions"], fallback.missions),
    storyEvents: normalizeToggle(raw["storyEvents"], fallback.storyEvents),
    championsMeeting: isOneOf(raw["championsMeeting"], CHAMPIONS_MEETING_KEYS)
      ? raw["championsMeeting"]
      : fallback.championsMeeting,
    shopTickets: isOneOf(raw["shopTickets"], SHOP_TICKET_KEYS) ? raw["shopTickets"] : fallback.shopTickets,
    leagueOfHeroes: isOneOf(raw["leagueOfHeroes"], LEAGUE_OF_HEROES_KEYS) ? raw["leagueOfHeroes"] : fallback.leagueOfHeroes,
    strongestTeam: isOneOf(raw["strongestTeam"], STRONGEST_TEAM_KEYS) ? raw["strongestTeam"] : fallback.strongestTeam,
    legendRaces: normalizeToggle(raw["legendRaces"], fallback.legendRaces),
    skillTests: normalizeToggle(raw["skillTests"], fallback.skillTests),
    masters: isOneOf(raw["masters"], MASTERS_KEYS) ? raw["masters"] : fallback.masters,
  };
}

export function samePlayStyleSettings(a: PlayStyleSettings, b: PlayStyleSettings): boolean {
  return (
    a.dailies === b.dailies &&
    a.weeklyLogin === b.weeklyLogin &&
    a.teamTrials === b.teamTrials &&
    a.anniversaryMissions === b.anniversaryMissions &&
    a.holidays === b.holidays &&
    a.scenarioMissions === b.scenarioMissions &&
    a.traineeDebuts === b.traineeDebuts &&
    a.factorStudies === b.factorStudies &&
    a.racingCarnival === b.racingCarnival &&
    a.showtime === b.showtime &&
    a.missions === b.missions &&
    a.storyEvents === b.storyEvents &&
    a.championsMeeting === b.championsMeeting &&
    a.shopTickets === b.shopTickets &&
    a.leagueOfHeroes === b.leagueOfHeroes &&
    a.strongestTeam === b.strongestTeam &&
    a.legendRaces === b.legendRaces &&
    a.skillTests === b.skillTests &&
    a.masters === b.masters
  );
}
