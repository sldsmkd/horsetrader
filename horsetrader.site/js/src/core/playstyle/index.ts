/** Play-style: the account's engagement archetype + per-stream assumptions, and
 *  the resolver both the projection and the identity surface read through. */

export { PLAY_STYLE_KEYS, DEFAULT_PLAY_STYLE, isPlayStyleKey } from "./keys.ts";
export type { PlayStyleKey } from "./keys.ts";
export {
  WEEKLY_PLAY_KEYS,
  TEAM_TRIAL_KEYS,
  MISSION_KEYS,
  SPECIAL_MISSION_KEYS,
  STORY_EVENT_KEYS,
  CHAMPIONS_MEETING_KEYS,
  SHOP_TICKET_KEYS,
  playStyleSettingsForPreset,
  normalizePlayStyleSettings,
  samePlayStyleSettings,
} from "./settings.ts";
export type {
  WeeklyPlayKey,
  TeamTrialKey,
  MissionKey,
  SpecialMissionKey,
  StoryEventKey,
  ChampionsMeetingKey,
  ShopTicketKey,
  PlayStyleSettings,
} from "./settings.ts";
export { resolvePlayStyle } from "./resolve.ts";
export type { ResolvedPlayStyle } from "./resolve.ts";
