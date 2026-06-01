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
