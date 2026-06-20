/**
 * The play-style preset keys — the account's chosen archetype (identity-first,
 * planner-config second; see docs/frontend/identity-presets.md). Pure account
 * data: the DOM grid (ui/views/surfaces/playStylePreset) layers icons and copy on top.
 */

export const PLAY_STYLE_KEYS = ["sweetie", "casual", "focused", "dedicated", "unhinged", "custom"] as const;

export type PlayStyleKey = (typeof PLAY_STYLE_KEYS)[number];

export const DEFAULT_PLAY_STYLE = "focused" as const;

export function isPlayStyleKey(value: unknown): value is PlayStyleKey {
  return typeof value === "string" && (PLAY_STYLE_KEYS as readonly string[]).includes(value);
}
