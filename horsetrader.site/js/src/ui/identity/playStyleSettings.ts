import type { PlayStyleKey } from "../views/playStylePreset.ts";

export const WEEKLY_PLAY_KEYS = ["twoDays", "fourDays", "sixDays", "sevenDays"] as const;
export const TEAM_TRIAL_KEYS = ["rank4", "rank5", "rank55", "rank6"] as const;
export const LEGEND_RACE_KEYS = ["none", "one", "allPartial", "allFull"] as const;
export const MISSION_KEYS = ["none", "some", "most", "all"] as const;
export const SPECIAL_MISSION_KEYS = ["some", "welfare", "major", "all"] as const;
export const STORY_EVENT_KEYS = ["story", "welfare", "major", "achievement", "earlyAchievement"] as const;
export const CHAMPIONS_MEETING_KEYS = ["skip", "groupBContender", "groupBWinner", "groupARunnerUp", "groupAChampion"] as const;

export type WeeklyPlayKey = (typeof WEEKLY_PLAY_KEYS)[number];
export type TeamTrialKey = (typeof TEAM_TRIAL_KEYS)[number];
export type LegendRaceKey = (typeof LEGEND_RACE_KEYS)[number];
export type MissionKey = (typeof MISSION_KEYS)[number];
export type SpecialMissionKey = (typeof SPECIAL_MISSION_KEYS)[number];
export type StoryEventKey = (typeof STORY_EVENT_KEYS)[number];
export type ChampionsMeetingKey = (typeof CHAMPIONS_MEETING_KEYS)[number];

export interface PlayStyleSettings {
  weeklyPlay: WeeklyPlayKey;
  teamTrials: TeamTrialKey;
  legendRaces: LegendRaceKey;
  missions: MissionKey;
  specialMissions: SpecialMissionKey;
  storyEvents: StoryEventKey;
  championsMeeting: ChampionsMeetingKey;
}

const PRESET_SETTINGS: Record<Exclude<PlayStyleKey, "custom">, PlayStyleSettings> = {
  sweetie: {
    weeklyPlay: "twoDays",
    teamTrials: "rank4",
    legendRaces: "one",
    missions: "none",
    specialMissions: "some",
    storyEvents: "story",
    championsMeeting: "skip",
  },
  casual: {
    weeklyPlay: "fourDays",
    teamTrials: "rank5",
    legendRaces: "one",
    missions: "some",
    specialMissions: "welfare",
    storyEvents: "welfare",
    championsMeeting: "groupBContender",
  },
  focused: {
    weeklyPlay: "sixDays",
    teamTrials: "rank55",
    legendRaces: "allPartial",
    missions: "most",
    specialMissions: "major",
    storyEvents: "major",
    championsMeeting: "groupBWinner",
  },
  dedicated: {
    weeklyPlay: "sevenDays",
    teamTrials: "rank6",
    legendRaces: "allFull",
    missions: "all",
    specialMissions: "all",
    storyEvents: "achievement",
    championsMeeting: "groupARunnerUp",
  },
  unhinged: {
    weeklyPlay: "sevenDays",
    teamTrials: "rank6",
    legendRaces: "allFull",
    missions: "all",
    specialMissions: "all",
    storyEvents: "earlyAchievement",
    championsMeeting: "groupAChampion",
  },
};

function isOneOf<T extends string>(value: unknown, keys: readonly T[]): value is T {
  return typeof value === "string" && (keys as readonly string[]).includes(value);
}

export function playStyleSettingsForPreset(key: PlayStyleKey): PlayStyleSettings {
  return key === "custom" ? { ...PRESET_SETTINGS.focused } : { ...PRESET_SETTINGS[key] };
}

export function normalizePlayStyleSettings(value: unknown, fallback: PlayStyleSettings): PlayStyleSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ...fallback };
  const raw = value as Record<string, unknown>;
  return {
    weeklyPlay: isOneOf(raw["weeklyPlay"], WEEKLY_PLAY_KEYS) ? raw["weeklyPlay"] : fallback.weeklyPlay,
    teamTrials: isOneOf(raw["teamTrials"], TEAM_TRIAL_KEYS) ? raw["teamTrials"] : fallback.teamTrials,
    legendRaces: isOneOf(raw["legendRaces"], LEGEND_RACE_KEYS) ? raw["legendRaces"] : fallback.legendRaces,
    missions: isOneOf(raw["missions"], MISSION_KEYS) ? raw["missions"] : fallback.missions,
    specialMissions: isOneOf(raw["specialMissions"], SPECIAL_MISSION_KEYS)
      ? raw["specialMissions"]
      : fallback.specialMissions,
    storyEvents: isOneOf(raw["storyEvents"], STORY_EVENT_KEYS) ? raw["storyEvents"] : fallback.storyEvents,
    championsMeeting: isOneOf(raw["championsMeeting"], CHAMPIONS_MEETING_KEYS)
      ? raw["championsMeeting"]
      : fallback.championsMeeting,
  };
}

export function samePlayStyleSettings(a: PlayStyleSettings, b: PlayStyleSettings): boolean {
  return (
    a.weeklyPlay === b.weeklyPlay &&
    a.teamTrials === b.teamTrials &&
    a.legendRaces === b.legendRaces &&
    a.missions === b.missions &&
    a.specialMissions === b.specialMissions &&
    a.storyEvents === b.storyEvents &&
    a.championsMeeting === b.championsMeeting
  );
}
