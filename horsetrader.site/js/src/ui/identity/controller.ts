import { createOshiIndex, DEFAULT_OSHI_ID, selectedOshiOption } from "../oshi/index.ts";
import { DEFAULT_PLAY_STYLE } from "../views/playStylePreset.ts";
import type { PlayStyleKey } from "../views/playStylePreset.ts";
import { normalizePlayStyleSettings, playStyleSettingsForPreset } from "./playStyleSettings.ts";
import type { PlayStyleSettings } from "./playStyleSettings.ts";
import type { OshiOption, OshiSearchIndex } from "../oshi/index.ts";
import type { Coordinator } from "../../core/coordinator/index.ts";
import type { Bundle } from "../bundle/access.ts";

export interface MenuIdentity {
  label: string;
  icon: string;
}

export interface IdentityController {
  menuIdentity(): MenuIdentity;
  trainerName(): string;
  currentOshi(): OshiOption;
  oshiSearch(): OshiSearchIndex;
  savedPlayStyleKey(): PlayStyleKey;
  savedPlayStyleSettings(): PlayStyleSettings;
  commitPlayStyle(key: PlayStyleKey, settings: PlayStyleSettings): void;
  setTrainerName(name: string): void;
  setOshiId(id: string): void;
}

export function createIdentityController(coord: Coordinator, bundle: Bundle): IdentityController {
  const _oshiSearch = createOshiIndex(bundle);

  function identityConfig(): Record<string, unknown> {
    const config = coord.document().config;
    const identity = config?.["identity"];
    return typeof identity === "object" && identity !== null && !Array.isArray(identity)
      ? (identity as Record<string, unknown>)
      : {};
  }

  function updateIdentity(patch: Record<string, unknown>): void {
    const config = coord.document().config ?? {};
    coord.update({ config: { ...config, identity: { ...identityConfig(), ...patch } } });
  }

  function trainerName(): string {
    const name = identityConfig()["trainerName"];
    return typeof name === "string" && name.trim() ? name : "Kris";
  }

  function oshiId(): string {
    const id = identityConfig()["oshiId"];
    return typeof id === "string" && id.trim() ? id : DEFAULT_OSHI_ID;
  }

  function playStyleKey(): PlayStyleKey {
    const key = identityConfig()["playStyleKey"];
    return key === "sweetie" || key === "casual" || key === "focused" || key === "dedicated" || key === "unhinged"
      ? key
      : DEFAULT_PLAY_STYLE;
  }

  function playStyleSettings(): PlayStyleSettings {
    return normalizePlayStyleSettings(identityConfig()["playStyleSettings"], playStyleSettingsForPreset(playStyleKey()));
  }

  function commitPlayStyle(key: PlayStyleKey, settings: PlayStyleSettings): void {
    if (key !== "custom") updateIdentity({ playStyleKey: key, playStyleSettings: settings });
  }

  function currentOshi(): OshiOption {
    return selectedOshiOption(bundle, oshiId());
  }

  return {
    menuIdentity() {
      const oshi = currentOshi();
      return { label: oshi.name, icon: oshi.icon };
    },

    trainerName,
    currentOshi,
    oshiSearch: () => _oshiSearch,
    savedPlayStyleKey: playStyleKey,
    savedPlayStyleSettings: playStyleSettings,
    commitPlayStyle,
    setTrainerName: (name) => updateIdentity({ trainerName: name }),
    setOshiId: (id) => updateIdentity({ oshiId: id }),
  };
}
