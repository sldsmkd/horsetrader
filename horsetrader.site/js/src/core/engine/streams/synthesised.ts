/**
 * The five synthesisers — streams that mint events the bake doesn't carry,
 * each under its declared key prefix (fenced against the bake at registry
 * construction). The cadence/spec internals are the shipped, headless-tested
 * modules in `core/projection/streams/` — this file owns only the Eclipse
 * declaration shape and the minted-key naming; values stay baked, cadence
 * stays client logic, gating stays account state (the three-ownership rule,
 * docs/frontend/projection.md).
 *
 * Minted events are `visible: false` cadence (on the ledger, off the lane) and
 * are pre-filtered to dates after the snapshot purely for volume — the fold's
 * own after-filter is the correctness guarantee.
 */

import type { StreamEmission } from "../../projection/ledger.ts";
import { clubRankSpecFromBundle, clubRankStream } from "../../projection/streams/clubrank.ts";
import { dailyPackSpecFromBundle, dailyPackStream } from "../../projection/streams/dailypack.ts";
import { routineSpecFromBundle, routineStream } from "../../projection/streams/routine.ts";
import { shopTicketsSpecFromBundle, shopTicketsStream } from "../../projection/streams/shoptickets.ts";
import { teamTrialsSpecFromBundle, teamTrialsStream } from "../../projection/streams/teamtrials.ts";
import type { SettledEvent, Stream } from "../stream.ts";
import { minted } from "../stream.ts";

/** Wrap a cadence module's emissions as minted settled events. `keyFor` is the
 *  stream's minted-key naming — one key per (emission, date), under its mints. */
function asMinted(type: string, emissions: StreamEmission[], keyFor: (e: StreamEmission) => string): SettledEvent[] {
  return emissions.map((e) => minted(keyFor(e), type, e.date, e.deltas));
}

/** `play.routine` — daily mission carats + the per-login 7-slot bonus cycle,
 *  scaled by the `weeklyPlay` engagement level. Two minted families, named for
 *  the reward-structure keys they pay: `routine-dailies-<date>`,
 *  `routine-weekly-login-<date>`. */
export const playRoutine: Stream = {
  id: "play.routine",
  claims: [],
  mints: ["routine-"],
  enabled: (ctx) => routineSpecFromBundle(ctx.bundle, ctx.config, ctx.play.weeklyPlay, ctx.timeZone) !== null,
  events(ctx) {
    const spec = routineSpecFromBundle(ctx.bundle, ctx.config, ctx.play.weeklyPlay, ctx.timeZone);
    if (!spec) return [];
    return asMinted("routine", routineStream(spec, ctx.after), (e) => `routine-${e.source}-${e.date}`);
  },
};

/** `play.team-trials` — the weekly Monday carats, graded by the class-transition
 *  cycle the `teamTrials` level walks. */
export const playTeamTrials: Stream = {
  id: "play.team-trials",
  claims: [],
  mints: ["team-"],
  enabled: (ctx) => teamTrialsSpecFromBundle(ctx.bundle, ctx.config, ctx.play.teamTrials, ctx.timeZone) !== null,
  events(ctx) {
    const spec = teamTrialsSpecFromBundle(ctx.bundle, ctx.config, ctx.play.teamTrials, ctx.timeZone);
    if (!spec) return [];
    return asMinted("team-trials", teamTrialsStream(spec, ctx.after), (e) => `team-trials-${e.date}`);
  },
};

/** `identity.club-rank` — the monthly 1st-of-month carats at the identity's club
 *  rank (an IDENTITY selector, not play-style; null rank ⇒ not in a club ⇒ gated). */
export const identityClubRank: Stream = {
  id: "identity.club-rank",
  claims: [],
  mints: ["club-"],
  enabled: (ctx) => ctx.clubRank !== null,
  events(ctx) {
    if (ctx.clubRank === null) return [];
    const spec = clubRankSpecFromBundle(ctx.bundle, ctx.config, ctx.clubRank, ctx.timeZone);
    if (!spec) return [];
    return asMinted("club-rank", clubRankStream(spec, ctx.after), (e) => `club-rank-${e.date}`);
  },
};

/** `play.shop-tickets` — monthly scout-ticket purchases; the engagement bracket
 *  IS the count (a gating choice like routine's days-per-week, not game data). */
export const playShopTickets: Stream = {
  id: "play.shop-tickets",
  claims: [],
  mints: ["shop-"],
  enabled: (ctx) => ctx.play.shopTickets !== "none",
  events(ctx) {
    const spec = shopTicketsSpecFromBundle(ctx.bundle, ctx.play.shopTickets, ctx.timeZone);
    if (!spec) return [];
    return asMinted("shop-tickets", shopTicketsStream(spec, ctx.after), (e) => `shop-tickets-${e.date}`);
  },
};

/** `subscription.daily-pack` — the Daily Carat Pack as an always-on subscription:
 *  a daily free drip plus the paid grant on each 30-day cycle boundary phased off
 *  the validity date. Two minted families (they can share a date): the drip keys
 *  `daily-carats-<date>`, the purchase grant `daily-pack-<date>`. */
export const subscriptionDailyPack: Stream = {
  id: "subscription.daily-pack",
  claims: [],
  mints: ["daily-"],
  enabled: (ctx) => ctx.dailyPack !== null,
  events(ctx) {
    const spec = dailyPackSpecFromBundle(ctx.bundle, ctx.config, ctx.dailyPack, ctx.timeZone);
    if (!spec) return [];
    return asMinted("daily-pack", dailyPackStream(spec, ctx.after), (e) =>
      e.deltas["paid_carats"] !== undefined ? `daily-pack-${e.date}` : `daily-carats-${e.date}`,
    );
  },
};
