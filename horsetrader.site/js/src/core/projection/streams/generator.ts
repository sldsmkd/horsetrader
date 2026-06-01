/**
 * The generator channel: recurring payouts the client expands from a rule,
 * rather than the bundle enumerating one event per occurrence. A generator is
 * `{start, payload, repeat}` — it emits `payload` once a day from `start` for
 * `repeat` consecutive days, then stops. This is the procedural shape behind
 * daily rewards, and the cadence the bundle's `generator` reward needs to
 * expand. See docs/frontend/projection.md (the procedural-stream decomposition)
 * and docs/contract.md.
 *
 * The client owns the *cadence* (daily × repeat); every *value* in `payload`
 * comes from the bundle — never a game-data literal in client code. Kept on its
 * own channel from the discrete events, for provenance.
 */

import type { EventsBundle } from "../../bundle/events.gen.ts";
import type { ResourceVector, StreamEmission } from "../ledger.ts";
import { resourceOf } from "./rewards.ts";
import { addDays } from "../dates.ts";

/** A recurring daily payout: `payload` each day from `start`, for `repeat` days. */
export interface GeneratorSpec {
  source: string;
  start: string;
  payload: ResourceVector;
  repeat: number;
}

/**
 * Expand each spec into one emission per day. Only payouts landing strictly
 * after `after` (the snapshot date) are emitted; earlier days of a generator
 * that straddles the snapshot are already baked into the reading, but the later
 * days still emit — the recurrence is computed from `start`, not from the
 * snapshot, so straddling generators stay correct (see the anchor-boundary
 * warning in docs/frontend/projection.md).
 */
export function generatorStream(specs: GeneratorSpec[], after: string): StreamEmission[] {
  const emissions: StreamEmission[] = [];
  for (const spec of specs) {
    for (let day = 0; day < spec.repeat; day++) {
      const date = addDays(spec.start, day);
      if (date <= after) continue;
      emissions.push({ date, source: spec.source, deltas: { ...spec.payload } });
    }
  }
  return emissions;
}

/**
 * Extract the generator specs carried inline on bundle events (`rewards.generator
 * = {…payload, repeat}`). The generator originates at the event's `start`. A
 * generator with no payload or a non-numeric `repeat` is malformed and skipped.
 */
export function generatorsFromBundle(bundle: EventsBundle): GeneratorSpec[] {
  const specs: GeneratorSpec[] = [];
  for (const event of bundle.events) {
    const generator = event.rewards?.generator;
    if (typeof generator !== "object") continue;

    const repeat = generator["repeat"];
    if (typeof repeat !== "number") continue;

    const payload: ResourceVector = {};
    for (const [key, value] of Object.entries(generator)) {
      if (key === "repeat" || typeof value !== "number") continue;
      payload[resourceOf(key)] = value;
    }
    if (Object.keys(payload).length) specs.push({ source: event.key, start: event.start, payload, repeat });
  }
  return specs;
}
