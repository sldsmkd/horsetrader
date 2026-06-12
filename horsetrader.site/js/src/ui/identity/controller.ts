import { createOshiIndex, DEFAULT_OSHI_ID, selectedOshiOption } from "../query/index.ts";
import { resolveClub } from "../../core/identity/clubrank.ts";
import type { ClubIdentity, ClubRankTier } from "../../core/identity/clubrank.ts";
import { resolvePlayStyle } from "../../core/playstyle/index.ts";
import type { PlayStyleKey, PlayStyleSettings } from "../../core/playstyle/index.ts";
import { loadSupporters, verifySupporter } from "./supporters.ts";
import type { SupporterRegistry } from "./supporters.ts";
import type { OshiOption, OshiSearchIndex } from "../query/index.ts";
import type { Coordinator } from "../../core/engine/index.ts";
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
  /** The trainer's club, or `null` when they aren't in one. */
  club(): ClubIdentity | null;
  savedPlayStyleKey(): PlayStyleKey;
  savedPlayStyleSettings(): PlayStyleSettings;
  commitPlayStyle(key: PlayStyleKey, settings: PlayStyleSettings): void;
  setTrainerName(name: string): void;
  setTrainerId(id: string): void;
  setOshiId(id: string): void;
  /** Join or update the club (a non-empty name is membership). */
  setClub(name: string, rank: ClubRankTier): void;
  /** Leave the club — clears the name so the trainer is in no club. */
  leaveClub(): void;
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
    coord.setPlay(key, settings);
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
    club: () => resolveClub(coord.document().config),
    savedPlayStyleKey: playStyleKey,
    savedPlayStyleSettings: playStyleSettings,
    commitPlayStyle,
    setTrainerName: (name) => coord.patchIdentity({ trainerName: name }),
    setTrainerId: (id) => coord.patchIdentity({ trainerId: id }),
    setOshiId: (id) => coord.patchIdentity({ oshiId: id }),
    setClub: (name, rank) => coord.setClub(name, rank),
    leaveClub: () => coord.setClub("", null),
  };
}
