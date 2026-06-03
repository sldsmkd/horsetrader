/**
 * Typed bundle data-access — the primitive that parses the baked JSON once into
 * id-keyed lookups, so the UI never touches raw bundle JSON (the layer cake's
 * bottom row, docs/frontend/interaction.md). Views and selectors resolve a
 * stable key/id to a typed record through here.
 *
 * A lookup **resolves or throws** — the same stance as `qs()`. The ETL bake
 * guarantees referential integrity (a banner's `contents`, a ledger `source`
 * all point at records that exist), so a miss is a *wiring/data bug* to surface
 * loudly, not a runtime condition every caller must guard. Returns stay non-null
 * and call sites read clean. (See docs/frontend/trust-and-failure.md — trust the
 * bake.)
 *
 * Events are keyed by `key` (the same id the ledger carries as `source`, so a
 * ledger fact resolves straight back to its event). Academy entities are keyed
 * by their stable id (the strings a banner's `contents` holds).
 */

import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import type { Academy, CharacterRecord, SupportRecord, TraineeRecord } from "../../core/bundle/academy.gen.ts";

/** One event of any kind — the discriminated union the bundle actually holds. */
export type EventRecord = EventsBundle["events"][number];

export interface Bundle {
  /** The event with this `key` (= a ledger entry's `source`). Throws if absent. */
  event(key: string): EventRecord;
  /** Academy lookups — the entities a banner's `contents` resolve to. Throw if absent. */
  character(id: string): CharacterRecord;
  support(id: string): SupportRecord;
  trainee(id: string): TraineeRecord;
}

/** Resolve-or-throw: a miss is a referential-integrity bug the ETL must not ship. */
function must<T>(value: T | undefined, kind: string, id: string): T {
  if (value === undefined) throw new Error(`bundle: no ${kind} for "${id}"`);
  return value;
}

export function createBundle(events: EventsBundle, academy: Academy): Bundle {
  const byKey = new Map<string, EventRecord>(events.events.map((e) => [e.key, e]));
  return {
    event: (key) => must(byKey.get(key), "event", key),
    character: (id) => must(academy.characters[id], "character", id),
    support: (id) => must(academy.supports[id], "support", id),
    trainee: (id) => must(academy.trainees[id], "trainee", id),
  };
}
