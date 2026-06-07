import type { PlayStyleKey } from "../views/playStylePreset.ts";

export type LegendRaceKey = "none" | "one" | "allPartial" | "allFull";

export interface PlayStyleSettings {
  legendRaces: LegendRaceKey;
}

const PRESET_SETTINGS: Record<Exclude<PlayStyleKey, "custom">, PlayStyleSettings> = {
  sweetie: { legendRaces: "one" },
  casual: { legendRaces: "one" },
  focused: { legendRaces: "allPartial" },
  dedicated: { legendRaces: "allFull" },
  unhinged: { legendRaces: "allFull" },
};

function isLegendRaceKey(value: unknown): value is LegendRaceKey {
  return value === "none" || value === "one" || value === "allPartial" || value === "allFull";
}

export function playStyleSettingsForPreset(key: PlayStyleKey): PlayStyleSettings {
  return key === "custom" ? { legendRaces: "allPartial" } : { ...PRESET_SETTINGS[key] };
}

export function normalizePlayStyleSettings(value: unknown, fallback: PlayStyleSettings): PlayStyleSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ...fallback };
  const raw = value as Record<string, unknown>;
  return {
    legendRaces: isLegendRaceKey(raw["legendRaces"]) ? raw["legendRaces"] : fallback.legendRaces,
  };
}

export function samePlayStyleSettings(a: PlayStyleSettings, b: PlayStyleSettings): boolean {
  return a.legendRaces === b.legendRaces;
}
