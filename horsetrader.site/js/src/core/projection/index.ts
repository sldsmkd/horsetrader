/**
 * Projection (pillar 2): derives everything visible from the stored inputs.
 * Pure `core/`, headless, deterministic. See docs/frontend/projection.md.
 */

export { project } from "./project.ts";
export type { NamedStream, Projection } from "./project.ts";
export { attribute, subtotals, balanceSeries } from "./ledger.ts";
export type { Ledger, LedgerEntry, BalanceSeries, StreamEmission, ResourceVector } from "./ledger.ts";
export { dailiesSpecFromBundle, dailiesStream, weeklyLoginSpecFromBundle, weeklyLoginStream } from "./streams/routine.ts";
export type { DailiesSpec, WeeklyLoginSpec } from "./streams/routine.ts";
export { teamTrialsStream, teamTrialsSpecFromBundle } from "./streams/teamtrials.ts";
export type { TeamTrialsSpec } from "./streams/teamtrials.ts";
export { clubRankStream, clubRankSpecFromBundle } from "./streams/clubrank.ts";
export type { ClubRankSpec } from "./streams/clubrank.ts";
export { shopTicketsStream, shopTicketsSpecFromBundle } from "./streams/shoptickets.ts";
export type { ShopTicketsSpec } from "./streams/shoptickets.ts";
export { dailyPackStream, dailyPackSpecFromBundle, resolveDailyPack } from "./streams/dailypack.ts";
export type { DailyPackSpec } from "./streams/dailypack.ts";
export { resolveTrainingPass } from "./streams/trainingpass.ts";
export { pullCapacity, spend, bannerDays } from "./pulls.ts";
export type { PullSources, PullCaps, PullCapacity, SpendDebit } from "./pulls.ts";
export { cal } from "./dates.ts";
export type { CalendarDate } from "./dates.ts";
