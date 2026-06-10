/**
 * The channel registry: how the bundle becomes projection streams. Each channel
 * is a named, independent `(date, deltas)` producer; the coordinator folds the
 * enabled ones via `project()`. Adding a reward source is adding a channel here —
 * never editing the fold. Toggling one off is the coordinator dropping it from
 * this list for a recompute; the channel keeps existing, it just stops
 * contributing. See docs/frontend/projection.md.
 */

import type { EventsBundle } from "../bundle/events.gen.ts";
import type { CalendarDate, StreamEmission } from "../projection/index.ts";
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
  after: CalendarDate;
  /** The calendar timezone the day-bucketed projection is viewed in. */
  timeZone: string;
}

export interface ChannelDef {
  name: string;
  emit(ctx: ChannelContext): StreamEmission[];
}

/** The ground-truth channels, in fold order — immutable bundle data, no user input. */
export const GROUND_TRUTH_CHANNELS: ChannelDef[] = [
  { name: "events", emit: ({ bundle, after, timeZone }) => eventStream(bundle, after, timeZone) },
  { name: "generator", emit: ({ bundle, after, timeZone }) => generatorStream(generatorsFromBundle(bundle, timeZone), after) },
  { name: "sequence", emit: ({ bundle, after, timeZone }) => sequenceStream(sequencesFromBundle(bundle, timeZone), after) },
];
