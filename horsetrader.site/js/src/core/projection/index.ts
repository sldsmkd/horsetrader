/**
 * Projection (pillar 2): derives everything visible from the stored inputs.
 * Pure `core/`, headless, deterministic. See docs/frontend/projection.md.
 */

export { project } from "./project.ts";
export type { NamedStream, Projection } from "./project.ts";
export { attribute, subtotals, balanceSeries } from "./ledger.ts";
export type { Ledger, LedgerEntry, BalanceSeries, StreamEmission, ResourceVector } from "./ledger.ts";
export { eventStream } from "./streams/events.ts";
export { generatorStream, generatorsFromBundle } from "./streams/generator.ts";
export type { GeneratorSpec } from "./streams/generator.ts";
export { sequenceStream, sequencesFromBundle } from "./streams/sequence.ts";
export type { SequenceSpec } from "./streams/sequence.ts";
export { routineStream, routineSpecFromBundle } from "./streams/routine.ts";
export type { RoutineSpec } from "./streams/routine.ts";
export { teamTrialsStream, teamTrialsSpecFromBundle } from "./streams/teamtrials.ts";
export type { TeamTrialsSpec } from "./streams/teamtrials.ts";
export { applyChampionsMeetingRewards, championsMeetingReward } from "./streams/championsmeeting.ts";
export { spendStream } from "./streams/spends.ts";
export type { CommittedBanner, SpendGacha, SpendStreamResult, BannerKind } from "./streams/spends.ts";
export { pullCapacity, spend, bannerDays } from "./pulls.ts";
export type { PullSources, PullCaps, PullCapacity, SpendDebit } from "./pulls.ts";
export { cal } from "./dates.ts";
export type { CalendarDate } from "./dates.ts";
