/**
 * Club rank is **identity**, not play-style: a trainer belongs to a club, and the
 * club's standing seeds a recurring carat reward (docs/frontend/menu.md — "Club
 * belongs in Identity, not forecasting configuration… the rank can still seed
 * reward assumptions"). So unlike the engagement levels (resolved by
 * `resolvePlayStyle`), the club rank rides in the same `config.identity` block but
 * is read through *here* — the single precedence the income channel and the trainer
 * sheet share, exactly as `resolvePlayStyle` is for play style.
 *
 * Membership is **optional**: a trainer may not be in a club at all, in which case
 * there is no monthly club-rank carat income. We key membership off `clubName` — a
 * non-empty name *is* the club — so a fresh account (no config) resolves to "no
 * club" (`null`) rather than a fabricated default. Only once in a club does the rank
 * matter; within a club an unset rank falls back to the default tier.
 *
 * The tier *labels are the `reward_maps.club-rank` keys* (an ordinal ladder, low →
 * high); the club-rank income channel selects its monthly row straight off the
 * resolved label, no translation map. The identity surface's club shield writes
 * `config.identity.clubName`/`clubRank` (and clears the name on Leave).
 */

import type { Config } from "../persistence/document.ts";

/** The club-rank ladder, low → high — byte-for-byte the `reward_maps.club-rank` keys. */
export const CLUB_RANK_TIERS = ["D+", "C", "C+", "B", "B+", "A", "A+", "S", "S+", "SS"] as const;

export type ClubRankTier = (typeof CLUB_RANK_TIERS)[number];

/** A resolved club membership: a non-empty name and the standing it pays at. */
export interface ClubIdentity {
  name: string;
  rank: ClubRankTier;
}

/** The rank a fresh membership seeds at, and the in-club fallback for an unset rank. */
export const DEFAULT_CLUB_RANK: ClubRankTier = "B+";

function isClubRankTier(value: unknown): value is ClubRankTier {
  return typeof value === "string" && (CLUB_RANK_TIERS as readonly string[]).includes(value);
}

/**
 * Resolve the account's club membership out of `config.identity`. Returns `null`
 * when the trainer isn't in a club (no/blank `clubName`) — the signal the club-rank
 * income channel reads to pay nothing. The single source of that precedence: both
 * the projection and the trainer sheet read through here, so the surface and the
 * projection can never disagree.
 */
export function resolveClub(config: Config | undefined): ClubIdentity | null {
  const identity = config?.["identity"];
  const raw =
    typeof identity === "object" && identity !== null && !Array.isArray(identity)
      ? (identity as Record<string, unknown>)
      : {};
  const name = raw["clubName"];
  if (typeof name !== "string" || !name.trim()) return null;
  return { name: name.trim(), rank: isClubRankTier(raw["clubRank"]) ? raw["clubRank"] : DEFAULT_CLUB_RANK };
}
