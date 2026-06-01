/**
 * The ETL event-driven stream: turns the baked event timeline into dated,
 * signed resource deltas. This is one of the two stream kinds — the other is
 * the client-rehydrated procedural streams (daily login, weekly login, …),
 * which the client expands from a recurrence rule and which need rates the
 * bundle does not yet carry. See docs/frontend/projection.md.
 *
 * A stream is a pure delta producer: it emits `(date, deltas)` and knows
 * nothing about its own attribution name or how the deltas are folded. The
 * projection composes streams into the attributed ledger.
 */

import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { ResourceVector, StreamEmission } from "../ledger.ts";
import { resourceOf } from "./rewards.ts";

/**
 * Emit the timeline's discrete rewards as dated deltas. Rewards land on an
 * event's `end` — the point the event has fully paid out. Only events landing
 * strictly after `after` (the snapshot date; anything on or before it is already
 * baked into the reading the projection starts from) are emitted.
 *
 * The repeating-bonus `generator` shape (`{payload, repeat}`) is *not* this
 * channel's concern — its nested value is skipped here and expanded separately
 * by the generator stream, which owns the recurrence (see ./generator.ts). This
 * keeps the two provenances on separate channels.
 */
export function eventStream(bundle: EventsBundle, after: string): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  for (const event of bundle.events) {
    if (!event.rewards) continue;
    const date = event.end;
    if (date <= after) continue;

    const deltas: ResourceVector = {};
    for (const [key, value] of Object.entries(event.rewards)) {
      if (typeof value !== "number") continue; // generator (nested) — separate channel
      const resource = resourceOf(key);
      deltas[resource] = (deltas[resource] ?? 0) + value;
    }
    if (Object.keys(deltas).length) emissions.push({ date, source: event.key, deltas });
  }
  return emissions;
}
