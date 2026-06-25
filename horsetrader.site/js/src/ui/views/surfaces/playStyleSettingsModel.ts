import {
  CHAMPIONS_MEETING_KEYS,
  LEAGUE_OF_HEROES_KEYS,
  MASTERS_KEYS,
  SHOP_TICKET_KEYS,
  STORY_KEYS,
  STRONGEST_TEAM_KEYS,
  TEAM_TRIAL_KEYS,
} from "../../../core/playstyle/index.ts";
import type { PlayStyleSettings, PlayToggleKey } from "../../../core/playstyle/index.ts";

export type PlayStyleSettingKey = keyof PlayStyleSettings;

type ToggleSettingKey = {
  [K in PlayStyleSettingKey]: PlayStyleSettings[K] extends PlayToggleKey
    ? PlayToggleKey extends PlayStyleSettings[K]
      ? K
      : never
    : never;
}[PlayStyleSettingKey];

export interface PlayStyleSettingDefinition<K extends PlayStyleSettingKey = PlayStyleSettingKey> {
  key: K;
  keys: readonly PlayStyleSettings[K][];
}

export interface PlayStyleCheckboxRowDefinition {
  checkboxes: readonly ToggleSettingKey[];
}

export type PlayStyleSectionEntry = PlayStyleSettingDefinition | PlayStyleCheckboxRowDefinition;

export interface PlayStyleSectionDefinition {
  title: string;
  description: string;
  entries: readonly PlayStyleSectionEntry[];
}

export const PLAY_STYLE_SECTIONS: readonly PlayStyleSectionDefinition[] = [
  {
    title: "PARTICIPATE",
    description: "Regular loops, story beats, and shop participation.",
    entries: [
      { checkboxes: ["dailies", "weeklyLogin", "traineeDebuts"] },
      { checkboxes: ["holidays", "anniversaryMissions", "scenarioMissions"] },
      { key: "teamTrials", keys: TEAM_TRIAL_KEYS },
      { key: "storyEvents", keys: STORY_KEYS },
      { key: "shopTickets", keys: SHOP_TICKET_KEYS },
    ],
  },
  {
    title: "ENGAGE",
    description: "Structured event modes and residual mission chores.",
    entries: [
      { checkboxes: ["factorStudies", "racingCarnival"] },
      { checkboxes: ["showtime", "missions"] },
    ],
  },
  {
    title: "CHALLENGE",
    description: "Harder structured PvE with real clear gates.",
    entries: [
      { checkboxes: ["legendRaces", "skillTests"] },
      { key: "masters", keys: MASTERS_KEYS },
    ],
  },
  {
    title: "COMPETE",
    description: "Expected PvP and roster-event outcomes.",
    entries: [
      { key: "championsMeeting", keys: CHAMPIONS_MEETING_KEYS },
      { key: "leagueOfHeroes", keys: LEAGUE_OF_HEROES_KEYS },
      { key: "strongestTeam", keys: STRONGEST_TEAM_KEYS },
    ],
  },
] as const;

export function isPlayStyleCheckboxRow(
  entry: PlayStyleSectionEntry,
): entry is PlayStyleCheckboxRowDefinition {
  return "checkboxes" in entry;
}

export function playStyleDecisionCount(section: PlayStyleSectionDefinition): number {
  return section.entries.reduce(
    (n, entry) => n + (isPlayStyleCheckboxRow(entry) ? entry.checkboxes.length : 1),
    0,
  );
}

export function withPlayStyleSetting<K extends PlayStyleSettingKey>(
  settings: PlayStyleSettings,
  key: K,
  value: PlayStyleSettings[K],
): PlayStyleSettings {
  return { ...settings, [key]: value };
}
