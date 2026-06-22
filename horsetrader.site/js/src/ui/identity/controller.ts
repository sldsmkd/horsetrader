import { createOshiCostumeIndex, createOshiIndex, DEFAULT_OSHI_ID, selectedOshiOption } from "../query/index.ts";
import { resolveClub } from "../../core/identity/clubrank.ts";
import type { ClubIdentity, ClubRankTier } from "../../core/identity/clubrank.ts";
import { resolvePlayStyle } from "../../core/playstyle/index.ts";
import type { PlayStyleKey, PlayStyleSettings } from "../../core/playstyle/index.ts";
import type { OshiCostumeIndex, OshiOption, OshiSearchIndex } from "../query/index.ts";
import type { Coordinator } from "../../core/engine/index.ts";
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
  oshiCostumes(): OshiCostumeIndex;
  /** The trainer's club, or `null` when they aren't in one. */
  club(): ClubIdentity | null;
  savedPlayStyleKey(): PlayStyleKey;
  savedPlayStyleSettings(): PlayStyleSettings;
  commitPlayStyle(key: PlayStyleKey, settings: PlayStyleSettings): void;
  setTrainerName(name: string): void;
  setOshiId(id: string): void;
  /** Join or update the club (a non-empty name is membership). */
  setClub(name: string, rank: ClubRankTier): void;
  /** Leave the club — clears the name so the trainer is in no club. */
  leaveClub(): void;
}

export function createIdentityController(coord: Coordinator, bundle: Bundle): IdentityController {
  const _oshiSearch = createOshiIndex(bundle);
  const _oshiCostumes = createOshiCostumeIndex(bundle);

  function identityConfig(): Record<string, unknown> {
    const config = coord.document().config;
    const identity = config?.["identity"];
    return typeof identity === "object" && identity !== null && !Array.isArray(identity)
      ? (identity as Record<string, unknown>)
      : {};
  }

  // The username is never-synced local state (not plan config) — read it straight
  // off the coordinator's local tree.
  function trainerName(): string {
    return coord.username().trim() ? coord.username() : "Unknown";
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
      // The pill reads as *you* — trainer name beside the oshi portrait.
      return { label: trainerName(), icon: currentOshi().icon };
    },

    trainerName,
    currentOshi,
    oshiSearch: () => _oshiSearch,
    oshiCostumes: () => _oshiCostumes,
    club: () => resolveClub(coord.document().config),
    savedPlayStyleKey: playStyleKey,
    savedPlayStyleSettings: playStyleSettings,
    commitPlayStyle,
    setTrainerName: (name) => coord.setUsername(name),
    setOshiId: (id) => coord.patchIdentity({ oshiId: id }),
    setClub: (name, rank) => coord.setClub(name, rank),
    leaveClub: () => coord.setClub("", null),
  };
}
