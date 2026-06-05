/**
 * The coordinator: the thin, headless seam that joins persistence (the user's
 * stored inputs) to projection (the derived ledger + balance series). It loads
 * the plan, builds the channels from the bundle, folds the enabled ones, and
 * recomputes whenever an input or a toggle changes. It knows nothing about the
 * DOM — the UI drives it through this surface and reads the result. See
 * docs/frontend/persistence.md (the "thin coordinator" note) and
 * docs/frontend/projection.md.
 *
 * Two kinds of state, deliberately separate:
 *   - The **plan** (snapshot/config/commitments/favourites) is persisted user
 *     input; mutating it saves and recomputes.
 *   - **Toggles** are ephemeral dev/debug isolation (hide a channel's
 *     contribution); they recompute but are never persisted into the plan.
 *
 * Recompute is the documented full scan: build a fresh immutable `Projection`
 * and swap it. Scrubbing reads the cached `series`, never recomputing.
 */

import type { EventsBundle } from "../bundle/events.gen.ts";
import type { PlanDocument } from "../persistence/index.ts";
import { load, save } from "../persistence/index.ts";
import type { KeyValueStore } from "../persistence/storage.ts";
import { defaultStore } from "../persistence/storage.ts";
import { project } from "../projection/index.ts";
import type { Projection, ResourceVector } from "../projection/index.ts";
import { UTC_TIME_ZONE } from "../projection/dates.ts";
import { GROUND_TRUTH_CHANNELS } from "./channels.ts";
import type { ChannelDef } from "./channels.ts";

/** The persisted plan sections a UI mutator can patch (never `version`). */
export type PlanPatch = Pick<PlanDocument, "snapshot" | "config" | "commitments" | "favourites">;

/** A channel and whether it is currently contributing — what a toggle UI renders. */
export interface ChannelState {
  name: string;
  enabled: boolean;
}

export interface Coordinator {
  /** The current immutable projection (ledger + cached balance series). */
  projection(): Projection;
  /** Convenience: the balance at a cursor date (O(1) into the cached series). */
  balanceAt(date: string): ResourceVector;
  /** The current persisted plan (read-only view). */
  document(): PlanDocument;
  /** Every known channel and its enabled state — for a toggle UI. */
  channels(): ChannelState[];
  /** True when the stored plan was unreadable and a clean one was started. */
  recovered(): boolean;
  /** Patch the plan, persist it, and recompute. */
  update(patch: Partial<PlanPatch>): void;
  /** Enable/disable a channel's contribution (ephemeral) and recompute. */
  setEnabled(channel: string, enabled: boolean): void;
  /**
   * Register a listener fired once after each recompute (an `update` or a
   * `setEnabled`); returns an unsubscribe. Reads — `projection`, `balanceAt`,
   * `document`, `channels` — never notify, so the cheap scrub path stays
   * broadcast-free. A bare callback keeps this DOM-agnostic. See
   * docs/frontend/interaction.md (the notify seam).
   */
  subscribe(listener: () => void): () => void;
}

export interface CoordinatorOptions {
  bundle: EventsBundle;
  /** Today as an ISO date — the projection origin when no snapshot is set yet. */
  now: string;
  /** Calendar timezone used to bucket baked event instants into projection dates. */
  timeZone?: string;
  /** Defaults to localStorage (or an in-memory store outside the browser). */
  store?: KeyValueStore;
  /** Defaults to the ground-truth channels; injectable for tests. */
  channels?: ChannelDef[];
}

export function createCoordinator(options: CoordinatorOptions): Coordinator {
  const { bundle, now } = options;
  const timeZone = options.timeZone ?? UTC_TIME_ZONE;
  const store = options.store ?? defaultStore();
  const registry = options.channels ?? GROUND_TRUTH_CHANNELS;

  const loaded = load(store);
  let doc = loaded.doc;
  const enabled = new Map<string, boolean>(registry.map((ch) => [ch.name, true]));
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function fold(): Projection {
    const after = doc.snapshot?.date ?? now;
    const base = doc.snapshot?.resources ?? {};
    const streams = registry
      .filter((ch) => enabled.get(ch.name) !== false)
      .map((ch) => ({ stream: ch.name, emissions: ch.emit({ bundle, after, timeZone }) }));
    return project({ date: after, resources: base }, streams);
  }

  let current = fold();

  return {
    projection: () => current,
    balanceAt: (date) => current.series.balanceAt(date),
    document: () => doc,
    channels: () => registry.map((ch) => ({ name: ch.name, enabled: enabled.get(ch.name) !== false })),
    recovered: () => loaded.recovered,
    update(patch) {
      doc = { ...doc, ...patch };
      save(doc, store);
      current = fold();
      notify();
    },
    setEnabled(channel, isEnabled) {
      if (!enabled.has(channel)) return; // unknown channel — nothing to toggle (no recompute, no notify)
      enabled.set(channel, isEnabled);
      current = fold();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
