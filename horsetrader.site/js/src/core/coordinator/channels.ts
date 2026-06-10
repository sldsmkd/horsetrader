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
  /** Event keys the player has rushed — their discrete payout attributes at
   *  `start`, not `end`. The events channel is the only one that honours it
   *  (compound rewards don't move); other channels ignore it. */
  rushed: ReadonlySet<string>;
}

export interface ChannelDef {
  name: string;
  emit(ctx: ChannelContext): StreamEmission[];
}

/** The ground-truth channels, in fold order — immutable bundle data. The only
 *  user input they read is `rushed` (the events channel pulls a rushed event's
 *  discrete payout forward to its start); amounts are never user-authored here. */
export const GROUND_TRUTH_CHANNELS: ChannelDef[] = [
  { name: "events", emit: ({ bundle, after, timeZone, rushed }) => eventStream(bundle, after, timeZone, rushed) },
  { name: "generator", emit: ({ bundle, after, timeZone }) => generatorStream(generatorsFromBundle(bundle, timeZone), after) },
  { name: "sequence", emit: ({ bundle, after, timeZone }) => sequenceStream(sequencesFromBundle(bundle, timeZone), after) },
];
