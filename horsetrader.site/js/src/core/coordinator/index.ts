/**
 * The coordinator: the headless seam joining persistence to projection. The UI
 * drives it and reads the result; it never touches the DOM. See coordinator.ts.
 */

export { createCoordinator } from "./coordinator.ts";
export type { Coordinator, CoordinatorOptions, PlanPatch, ChannelState } from "./coordinator.ts";
export { GROUND_TRUTH_CHANNELS } from "./channels.ts";
export type { ChannelDef, ChannelContext } from "./channels.ts";
