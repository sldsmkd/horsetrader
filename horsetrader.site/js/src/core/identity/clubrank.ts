/**
 * Club rank is **identity**, not play-style: a trainer belongs to a club, and the
 * club's standing seeds a recurring carat reward (docs/frontend/menu.md — "Club
 * belongs in Identity, not forecasting configuration… the rank can still seed
 * reward assumptions"). So unlike the engagement levels (resolved by
 * `resolvePlayStyle`), the club rank rides in the same `config.identity` block but
 * is read through *here* — the single precedence the income channel and the trainer
 * sheet share, exactly as `resolvePlayStyle` is for play style.
 *
 * The tier *labels are the `reward_maps.club-rank` keys* (an ordinal ladder, low →
 * high); the club-rank income channel selects its monthly row straight off the
 * resolved label, no translation map. Absent/malformed config falls back to the
 * default tier — which for now is hard-coded to the trainer sheet's placeholder
 * (`B+`) until the identity surface grows a real club-rank picker.
 */

import type { Config } from "../persistence/document.ts";

/** The club-rank ladder, low → high — byte-for-byte the `reward_maps.club-rank` keys. */
export const CLUB_RANK_TIERS = ["D+", "C", "C+", "B", "B+", "A", "A+", "S", "S+", "SS"] as const;

export type ClubRankTier = (typeof CLUB_RANK_TIERS)[number];

/** The placeholder the trainer sheet already shows; the resolver's fallback until
 *  an identity-surface picker writes `config.identity.clubRank`. */
export const DEFAULT_CLUB_RANK: ClubRankTier = "B+";

function isClubRankTier(value: unknown): value is ClubRankTier {
  return typeof value === "string" && (CLUB_RANK_TIERS as readonly string[]).includes(value);
}

/**
 * Resolve the account's club rank out of `config.identity.clubRank`, falling back
 * to the default tier when the block is absent or malformed. The single source of
 * that precedence — both the projection's club-rank income channel and the trainer
 * sheet read through here, so the surface and the projection can never disagree.
 */
export function resolveClubRank(config: Config | undefined): ClubRankTier {
  const identity = config?.["identity"];
  const raw =
    typeof identity === "object" && identity !== null && !Array.isArray(identity)
      ? (identity as Record<string, unknown>)
      : {};
  return isClubRankTier(raw["clubRank"]) ? raw["clubRank"] : DEFAULT_CLUB_RANK;
}
