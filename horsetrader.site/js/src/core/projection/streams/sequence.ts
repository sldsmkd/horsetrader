/**
 * The baked-sequence channel: a per-day schedule for a *single* reward type —
 * the shape behind daily-login bonuses. Each entry is the amount paid on that
 * login-day, or `null` for a day the type isn't paid (absence, not zero — the
 * type is fixed across the sequence, so a skip is the absence of that type).
 *
 * The ETL and the client share this shape: the ETL bakes income sequences,
 * which this channel ingests as ground truth; the client generates *spending*
 * strategies in the same shape on its own channel (still to come — that one
 * reads the running balance for affordability). See the SequenceReward type in
 * docs/contract.md and the decomposition in docs/frontend/projection.md.
 *
 * Like the generator, this is a pure `(date, deltas)` producer anchored at the
 * event start, one entry per consecutive day; null days emit nothing.
 */

import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { StreamEmission } from "../ledger.ts";
import { addDays } from "../dates.ts";

/** A per-day amount schedule for one resource, anchored at `start`; null = unpaid that day. */
export interface SequenceSpec {
  source: string;
  start: string;
  resource: string;
  amounts: (number | null)[];
}

/**
 * Expand each spec into one emission per paying day. Days are consecutive from
 * `start`; a `null` entry pays nothing. Only days landing strictly after
 * `after` (the snapshot date) emit — but, like the generator, the cadence is
 * computed from `start`, so a sequence straddling the snapshot keeps its later
 * days correct.
 */
export function sequenceStream(specs: SequenceSpec[], after: string): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  for (const spec of specs) {
    spec.amounts.forEach((amount, day) => {
      if (amount === null) return;
      const date = addDays(spec.start, day);
      if (date <= after) return;
      emissions.push({ date, source: spec.source, deltas: { [spec.resource]: amount } });
    });
  }
  return emissions;
}

/**
 * Extract the baked sequence carried inline on bundle events (`rewards.sequence
 * = {type, sequence}`). The sequence originates at the event's `start`. A
 * sequence with no string `type` or non-array `sequence` is malformed and skipped.
 */
export function sequencesFromBundle(bundle: EventsBundle): SequenceSpec[] {
  const specs: SequenceSpec[] = [];
  for (const event of bundle.events) {
    const sequence = event.rewards?.sequence;
    if (typeof sequence !== "object") continue;

    const type = sequence["type"];
    const amounts = sequence["sequence"];
    if (typeof type !== "string" || !Array.isArray(amounts)) continue;

    specs.push({ source: event.key, start: event.start, resource: type, amounts });
  }
  return specs;
}
