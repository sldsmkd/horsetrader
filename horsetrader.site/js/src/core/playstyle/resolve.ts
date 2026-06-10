/**
 * Resolve the persisted play-style out of the plan's `config.identity` block: the
 * chosen preset key, plus the per-stream settings normalized against that preset's
 * defaults. This is the *single* source of that precedence — both the projection
 * fold (income channels) and the identity controller (the viewer) read through
 * here, so the surface and the projection can never disagree on what the account
 * is set to. Absent or malformed config falls back to the default preset.
 */

import type { Config } from "../persistence/document.ts";
import { DEFAULT_PLAY_STYLE, isPlayStyleKey } from "./keys.ts";
import type { PlayStyleKey } from "./keys.ts";
import { normalizePlayStyleSettings, playStyleSettingsForPreset } from "./settings.ts";
import type { PlayStyleSettings } from "./settings.ts";

export interface ResolvedPlayStyle {
  key: PlayStyleKey;
  settings: PlayStyleSettings;
}

export function resolvePlayStyle(config: Config | undefined): ResolvedPlayStyle {
  const identity = config?.["identity"];
  const raw =
    typeof identity === "object" && identity !== null && !Array.isArray(identity)
      ? (identity as Record<string, unknown>)
      : {};
  const key = isPlayStyleKey(raw["playStyleKey"]) ? raw["playStyleKey"] : DEFAULT_PLAY_STYLE;
  const settings = normalizePlayStyleSettings(raw["playStyleSettings"], playStyleSettingsForPreset(key));
  return { key, settings };
}
