/**
 * The per-stream play-style assumptions: the engagement level the player picks
 * for each income stream (weekly play, Team Trials rank, …). These are *gating
 * choices* the projection's income channels resolve against baked reward tables —
 * never game-data values (docs/frontend/projection.md, docs/frontend/glue.md).
 * A preset seeds a full set; Custom edits them freely.
 */

import type { PlayStyleKey } from "./keys.ts";

export const WEEKLY_PLAY_KEYS = ["twoDays", "fourDays", "sixDays", "sevenDays"] as const;
export const TEAM_TRIAL_KEYS = ["rank4", "rank5", "rank55", "rank6"] as const;
// Normal missions are a binary do-them-or-don't gate, not a completion gradation:
// a percentage says nothing about *which* missions were done (each pays
// differently), so the only honest control is a yes/no. The engaged archetypes
// (dedicated/unhinged, and custom) do them; the lighter ones don't. See
// docs/frontend/glue.md (the mission model). Income gating still waits on the bake
// split (baseline-universal vs grindy) — this is the settled signal it will read.
export const MISSION_KEYS = ["no", "yes"] as const;
export const STORY_EVENT_KEYS = ["story", "welfare", "major", "achievement", "earlyAchievement"] as const;
export const CHAMPIONS_MEETING_KEYS = ["skip", "groupBContender", "groupBWinner", "groupARunnerUp", "groupAChampion"] as const;
export const SHOP_TICKET_KEYS = ["none", "cleats", "friendPoints", "rainbow"] as const;

export type WeeklyPlayKey = (typeof WEEKLY_PLAY_KEYS)[number];
export type TeamTrialKey = (typeof TEAM_TRIAL_KEYS)[number];
export type MissionKey = (typeof MISSION_KEYS)[number];
export type StoryEventKey = (typeof STORY_EVENT_KEYS)[number];
export type ChampionsMeetingKey = (typeof CHAMPIONS_MEETING_KEYS)[number];
export type ShopTicketKey = (typeof SHOP_TICKET_KEYS)[number];

export interface PlayStyleSettings {
  weeklyPlay: WeeklyPlayKey;
  teamTrials: TeamTrialKey;
  missions: MissionKey;
  storyEvents: StoryEventKey;
  championsMeeting: ChampionsMeetingKey;
  shopTickets: ShopTicketKey;
}

const PRESET_SETTINGS: Record<Exclude<PlayStyleKey, "custom">, PlayStyleSettings> = {
  sweetie: {
    weeklyPlay: "twoDays",
    teamTrials: "rank4",
    missions: "no",
    storyEvents: "story",
    championsMeeting: "skip",
    shopTickets: "none",
  },
  casual: {
    weeklyPlay: "fourDays",
    teamTrials: "rank5",
    missions: "no",
    storyEvents: "welfare",
    championsMeeting: "groupBContender",
    shopTickets: "none",
  },
  focused: {
    weeklyPlay: "sixDays",
    teamTrials: "rank55",
    missions: "no",
    storyEvents: "major",
    championsMeeting: "groupBWinner",
    shopTickets: "cleats",
  },
  dedicated: {
    weeklyPlay: "sevenDays",
    teamTrials: "rank6",
    missions: "yes",
    storyEvents: "achievement",
    championsMeeting: "groupARunnerUp",
    shopTickets: "friendPoints",
  },
  unhinged: {
    weeklyPlay: "sevenDays",
    teamTrials: "rank6",
    missions: "yes",
    storyEvents: "earlyAchievement",
    championsMeeting: "groupAChampion",
    shopTickets: "rainbow",
  },
};

function isOneOf<T extends string>(value: unknown, keys: readonly T[]): value is T {
  return typeof value === "string" && (keys as readonly string[]).includes(value);
}

export function playStyleSettingsForPreset(key: PlayStyleKey): PlayStyleSettings {
  // Custom seeds from focused but does missions (it's the engaged trainer's own
  // preset — the third "yes" group alongside dedicated/unhinged).
  return key === "custom"
    ? { ...PRESET_SETTINGS.focused, missions: "yes" }
    : { ...PRESET_SETTINGS[key] };
}

export function normalizePlayStyleSettings(value: unknown, fallback: PlayStyleSettings): PlayStyleSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ...fallback };
  const raw = value as Record<string, unknown>;
  return {
    weeklyPlay: isOneOf(raw["weeklyPlay"], WEEKLY_PLAY_KEYS) ? raw["weeklyPlay"] : fallback.weeklyPlay,
    teamTrials: isOneOf(raw["teamTrials"], TEAM_TRIAL_KEYS) ? raw["teamTrials"] : fallback.teamTrials,
    missions: isOneOf(raw["missions"], MISSION_KEYS) ? raw["missions"] : fallback.missions,
    storyEvents: isOneOf(raw["storyEvents"], STORY_EVENT_KEYS) ? raw["storyEvents"] : fallback.storyEvents,
    championsMeeting: isOneOf(raw["championsMeeting"], CHAMPIONS_MEETING_KEYS)
      ? raw["championsMeeting"]
      : fallback.championsMeeting,
    shopTickets: isOneOf(raw["shopTickets"], SHOP_TICKET_KEYS) ? raw["shopTickets"] : fallback.shopTickets,
  };
}

export function samePlayStyleSettings(a: PlayStyleSettings, b: PlayStyleSettings): boolean {
  return (
    a.weeklyPlay === b.weeklyPlay &&
    a.teamTrials === b.teamTrials &&
    a.missions === b.missions &&
    a.storyEvents === b.storyEvents &&
    a.championsMeeting === b.championsMeeting &&
    a.shopTickets === b.shopTickets
  );
}
