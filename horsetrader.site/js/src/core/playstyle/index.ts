/** Play-style: the account's engagement archetype + per-stream assumptions, and
 *  the resolver both the projection and the identity surface read through. */

export { PLAY_STYLE_KEYS, DEFAULT_PLAY_STYLE, isPlayStyleKey } from "./keys.ts";
export type { PlayStyleKey } from "./keys.ts";
export {
  PLAY_TOGGLE_KEYS,
  TEAM_TRIAL_KEYS,
  MISSION_KEYS,
  CHAMPIONS_MEETING_KEYS,
  SHOP_TICKET_KEYS,
  LEAGUE_OF_HEROES_KEYS,
  STRONGEST_TEAM_KEYS,
  MASTERS_KEYS,
  STORY_KEYS,
  playStyleSettingsForPreset,
  normalizePlayStyleSettings,
  samePlayStyleSettings,
} from "./settings.ts";
export type {
  PlayToggleKey,
  TeamTrialKey,
  MissionKey,
  ChampionsMeetingKey,
  ShopTicketKey,
  LeagueOfHeroesKey,
  StrongestTeamKey,
  MastersKey,
  StoryKey,
  PlayStyleSettings,
} from "./settings.ts";
export { resolvePlayStyle } from "./resolve.ts";
export type { ResolvedPlayStyle } from "./resolve.ts";
