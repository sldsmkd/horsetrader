import { createOshiIndex, DEFAULT_OSHI_ID, selectedOshiOption } from "../query/index.ts";
import { resolvePlayStyle } from "../../core/playstyle/index.ts";
import type { PlayStyleKey, PlayStyleSettings } from "../../core/playstyle/index.ts";
import { loadSupporters, verifySupporter } from "./supporters.ts";
import type { SupporterRegistry } from "./supporters.ts";
import type { OshiOption, OshiSearchIndex } from "../query/index.ts";
import type { Coordinator } from "../../core/coordinator/index.ts";
import type { Bundle } from "../bundle/access.ts";

export interface MenuIdentity {
  label: string;
  icon: string;
}

export interface IdentityController {
  menuIdentity(): MenuIdentity;
  trainerName(): string;
  trainerId(): string;
  /** True iff this trainer's ID + name match a published supporter entry. */
  isSupporter(): Promise<boolean>;
  currentOshi(): OshiOption;
  oshiSearch(): OshiSearchIndex;
  savedPlayStyleKey(): PlayStyleKey;
  savedPlayStyleSettings(): PlayStyleSettings;
  commitPlayStyle(key: PlayStyleKey, settings: PlayStyleSettings): void;
  setTrainerName(name: string): void;
  setTrainerId(id: string): void;
  setOshiId(id: string): void;
}

export function createIdentityController(coord: Coordinator, bundle: Bundle): IdentityController {
  const _oshiSearch = createOshiIndex(bundle);
  let _supporters: Promise<SupporterRegistry> | undefined;

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

  function trainerId(): string {
    const id = identityConfig()["trainerId"];
    return typeof id === "string" ? id.replace(/\D/g, "").slice(0, 12) : "";
  }

  function oshiId(): string {
    const id = identityConfig()["oshiId"];
    return typeof id === "string" && id.trim() ? id : DEFAULT_OSHI_ID;
  }

  function playStyleKey(): PlayStyleKey {
    return resolvePlayStyle(coord.document().config).key;
  }

  function playStyleSettings(): PlayStyleSettings {
    return resolvePlayStyle(coord.document().config).settings;
  }

  function commitPlayStyle(key: PlayStyleKey, settings: PlayStyleSettings): void {
    updateIdentity({ playStyleKey: key, playStyleSettings: settings });
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
    trainerId,
    async isSupporter() {
      _supporters ??= loadSupporters();
      return verifySupporter(await _supporters, trainerId(), trainerName());
    },
    currentOshi,
    oshiSearch: () => _oshiSearch,
    savedPlayStyleKey: playStyleKey,
    savedPlayStyleSettings: playStyleSettings,
    commitPlayStyle,
    setTrainerName: (name) => updateIdentity({ trainerName: name }),
    setTrainerId: (id) => updateIdentity({ trainerId: id }),
    setOshiId: (id) => updateIdentity({ oshiId: id }),
  };
}
