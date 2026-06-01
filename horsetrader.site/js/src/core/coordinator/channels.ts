/**
 * The channel registry: how the bundle becomes projection streams. Each channel
 * is a named, independent `(date, deltas)` producer; the coordinator folds the
 * enabled ones via `project()`. Adding a reward source is adding a channel here —
 * never editing the fold. Toggling one off is the coordinator dropping it from
 * this list for a recompute; the channel keeps existing, it just stops
 * contributing. See docs/frontend/projection.md.
 */

import type { EventsBundle } from "../bundle/events.gen.ts";
import type { StreamEmission } from "../projection/index.ts";
import {
  eventStream,
  generatorStream,
  generatorsFromBundle,
  sequenceStream,
  sequencesFromBundle,
} from "../projection/index.ts";

export interface ChannelContext {
  bundle: EventsBundle;
  /** The projection origin date; channels emit only strictly after it. */
  after: string;
}

export interface ChannelDef {
  name: string;
  emit(ctx: ChannelContext): StreamEmission[];
}

/** The ground-truth channels, in fold order — immutable bundle data, no user input. */
export const GROUND_TRUTH_CHANNELS: ChannelDef[] = [
  { name: "events", emit: ({ bundle, after }) => eventStream(bundle, after) },
  { name: "generator", emit: ({ bundle, after }) => generatorStream(generatorsFromBundle(bundle), after) },
  { name: "sequence", emit: ({ bundle, after }) => sequenceStream(sequencesFromBundle(bundle), after) },
];
