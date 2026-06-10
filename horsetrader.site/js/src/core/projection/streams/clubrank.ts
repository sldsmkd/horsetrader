/**
 * The club-rank channel: the player's recurring **monthly** Club Rank carats,
 * credited on the 1st at server reset and graded by the club's standing. It is a
 * synthesised income channel that reads a baked reward table
 * (`reward_maps.club-rank`) and one resolved selector, then walks the shared
 * monthly cadence across the bundle span (docs/frontend/glue.md, projection.md).
 *
 * Two ways it differs from the team-trials twin: the cadence is the calendar month
 * (`monthlyStream`), and the payout is flat per rank — Club Rank pays the same
 * whether you climbed in or held, so a single `ResourceVector`, no flap cycle. The
 * *rank* is the only selector.
 *
 * The selector is **identity**, not play-style: it comes from `resolveClubRank`
 * (config.identity.clubRank), supplied to the spec builder already resolved. The
 * client owns only the *cadence*; every value comes from the baked config.
 */

import type { ConfigBundle } from "../../bundle/config.gen.ts";
import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { ResourceVector, StreamEmission } from "../ledger.ts";
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE } from "../dates.ts";
import { flatPayload } from "./rewardmap.ts";
import { monthlyStream } from "./monthly.ts";
import { bundleSpan } from "./span.ts";

/** The attribution source for this channel — traceable to the reward-map slug. */
const CLUB_RANK_SOURCE = "club-rank";

/** The synthesised monthly-income plan: the cadence span and the flat per-month payout. */
export interface ClubRankSpec {
  /** Server epoch — the earliest bundle date; the monthly cadence anchors here. */
  epoch: CalendarDate;
  /** Last day to generate (the timeline's right edge — the latest bundle date). */
  horizon: CalendarDate;
  /** The flat monthly payout (the resolved rank's row), credited on every 1st. */
  monthly: ResourceVector;
}

/** Expand a club-rank spec into one emission per month-start across the span. */
export function clubRankStream(spec: ClubRankSpec, after: CalendarDate): StreamEmission[] {
  return monthlyStream(spec.epoch, spec.horizon, after, CLUB_RANK_SOURCE, spec.monthly);
}

/**
 * Build the club-rank spec from the baked config, the bundle's date span, and the
 * already-resolved club rank (an identity selector, the `reward_maps.club-rank`
 * label). Returns `null` when the channel can't run — the baked map absent, the
 * rank's row missing, or a bundle with no events (no span).
 */
export function clubRankSpecFromBundle(
  bundle: EventsBundle,
  config: ConfigBundle,
  clubRank: string,
  timeZone: string = UTC_TIME_ZONE,
): ClubRankSpec | null {
  const tiers = config.reward_maps[CLUB_RANK_SOURCE];
  if (tiers === undefined) return null;

  const row = tiers[clubRank];
  if (row === undefined) return null; // the resolved rank names a row the bake doesn't carry

  const span = bundleSpan(bundle, timeZone);
  if (span === null) return null;

  return { epoch: span.epoch, horizon: span.horizon, monthly: flatPayload(row) };
}
