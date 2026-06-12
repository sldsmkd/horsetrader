/**
 * The Eclipse engine: the whole economic model, headless. The web app is one
 * client; a CLI report is another. See eclipse/2.DESIGN.md (model),
 * 3.INTERFACE.md (this boundary), 4.REGISTRY.md (the roster).
 */

export { createCoordinator } from "./coordinator.ts";
export type { Coordinator, CoordinatorOptions, StreamState } from "./coordinator.ts";
export { DEFAULT_STREAMS, buildRegistry } from "./registry.ts";
export type { Registry } from "./registry.ts";
export type { BakedEvent, SettledEvent, Stream, StreamCtx, TaggedEvents } from "./stream.ts";
export { minted } from "./stream.ts";
export { settle, settleAll } from "./rules/settle.ts";
export { gradedStamp } from "./rules/gradedstamp.ts";
export type { GradedStampSpec } from "./rules/gradedstamp.ts";
export { reconcile, RECONCILIATION_STREAM } from "./reconcile.ts";
export type { Gacha, ReconcileResult } from "./reconcile.ts";
