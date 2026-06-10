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
import type { CalendarDate } from "../dates.ts";
import { UTC_TIME_ZONE, dateStringInTimeZone } from "../dates.ts";

/**
 * Emit the timeline's discrete rewards as dated deltas. Rewards land on an
 * event's `end` — the point the event has fully paid out — *unless the player
 * has rushed it*, in which case the discrete payout is pulled forward to the
 * event's `start` (its key is in `rushed`; the impulse-control decision, not a
 * planning one — see project_rushed_feature). Only events whose effective date
 * lands strictly after `after` (the snapshot date; anything on or before it is
 * already baked into the reading the projection starts from) are emitted — so
 * rushing an event whose `start` precedes the snapshot drops it (already banked).
 *
 * The repeating-bonus `generator` shape (`{payload, repeat}`) is *not* this
 * channel's concern — its nested value is skipped here and expanded separately
 * by the generator stream, which owns the recurrence (see ./generator.ts). This
 * keeps the two provenances on separate channels. Compound rewards are likewise
 * unmoved by rush: only this channel's discrete payout shifts to `start`.
 *
 * `pulls` is also skipped: a banner's free pulls are **scoped to that banner**
 * (use-them-or-lose-them on its own run), never a carried resource — banking them
 * would let one banner's free 10-roll be "spent" on a later banner. They are read
 * straight off the banner record at the point of spend (the readout's `freePulls`
 * and the commit shield's Free stream), never folded. Only carryable resources
 * (carats, tickets, crystals/shards) accumulate here.
 */
export function eventStream(
  bundle: EventsBundle,
  after: CalendarDate,
  timeZone: string = UTC_TIME_ZONE,
  rushed: ReadonlySet<string> = new Set(),
): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  for (const event of bundle.events) {
    if (!event.rewards) continue;
    // Rushed → the discrete payout is brought forward from `end` to `start`.
    const date = dateStringInTimeZone(rushed.has(event.key) ? event.start : event.end, timeZone);
    if (date <= after) continue;

    const deltas: ResourceVector = {};
    for (const [key, value] of Object.entries(event.rewards)) {
      if (typeof value !== "number") continue; // generator (nested) — separate channel
      if (key === "pulls") continue; // banner-scoped free pulls — read at the banner, never banked
      deltas[key] = (deltas[key] ?? 0) + value;
    }
    if (Object.keys(deltas).length) emissions.push({ date, source: event.key, deltas });
  }
  return emissions;
}
