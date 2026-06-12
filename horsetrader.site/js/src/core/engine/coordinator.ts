/**
 * The coordinator — the engine's public boundary (eclipse/3.INTERFACE.md). One
 * object a client holds: construct it with the bake, write account state
 * through typed mutators, read derivations, observe recomputes. The loop:
 * shields write account state; streams read it into events; the fold reads
 * events into money; surfaces read both. Nothing else moves.
 *
 * The projection is never written — only derived. Account state (snapshot,
 * config, commitments, favourites, rushed) is the write store; every mutator
 * is sugar over ONE private path: patch a section, persist, re-derive, notify.
 * Re-derivability, not reversibility.
 *
 * Pipeline per derivation: route claims → run enabled streams → UNION = the
 * settled world (render source AND fold input) → one generic fold → P_income
 * → reconcile(commitments) → P_final. The settled world lives exactly one
 * fold; ctx is frozen for its duration.
 */

import type { ConfigBundle } from "../bundle/config.gen.ts";
import type { EventsBundle } from "../bundle/events.gen.ts";
import { resolveClub } from "../identity/clubrank.ts";
import type { ClubRankTier } from "../identity/clubrank.ts";
import type { Snapshot } from "../persistence/document.ts";
import type { PlanDocument } from "../persistence/index.ts";
import { load, save } from "../persistence/index.ts";
import type { KeyValueStore } from "../persistence/storage.ts";
import { defaultStore } from "../persistence/storage.ts";
import type { PlayStyleKey, PlayStyleSettings } from "../playstyle/index.ts";
import { resolvePlayStyle } from "../playstyle/index.ts";
import { UTC_TIME_ZONE, cal, dateStringInTimeZone } from "../projection/dates.ts";
import type { CalendarDate } from "../projection/dates.ts";
import type { Projection } from "../projection/project.ts";
import type { ResourceVector } from "../projection/ledger.ts";
import { resolveDailyPack } from "../projection/streams/dailypack.ts";
import { resolveTrainingPass } from "../projection/streams/trainingpass.ts";
import { deriveEmissions, foldIncome } from "./fold.ts";
import { RECONCILIATION_STREAM, reconcile } from "./reconcile.ts";
import type { Gacha } from "./reconcile.ts";
import { DEFAULT_STREAMS, buildRegistry } from "./registry.ts";
import type { SettledEvent, Stream, StreamCtx, TaggedEvents } from "./stream.ts";

/** A stream and whether it is currently contributing — what a dev-toggle UI renders. */
export interface StreamState {
  id: string;
  enabled: boolean;
}

export interface Coordinator {
  /** The settled world — the render source. Cards = the `visible` events,
   *  reward faces included; `visible: false` is ledger-only cadence. */
  settledEvents(): readonly SettledEvent[];
  /** P_final: the rich attributed ledger + the dense O(1) balance series. */
  projection(): Projection;
  /** Convenience: the P_final balance at a cursor date (O(1), never refolds). */
  balanceAt(date: CalendarDate): ResourceVector;
  /** What a claim against this event sees — income at its `end` minus every
   *  earlier-by-start claim, self-excluded (a P_income query, never P_final).
   *  `undefined` when the event carries no claim. */
  availableFor(eventKey: string): ResourceVector | undefined;
  /** The persisted account state (read-only view). */
  document(): PlanDocument;
  /** Every stream and its ephemeral toggle state. */
  streams(): StreamState[];
  /** True when the stored account state was unreadable and a clean one began. */
  recovered(): boolean;

  // ── Write: typed intent, one private path ─────────────────────────────────
  /** Raise/adjust a claim against an event (0 clears it). */
  commit(eventKey: string, pity: number): void;
  /** The account's play-style — engagement levels the play streams grade by. */
  setPlay(key: PlayStyleKey, settings: PlayStyleSettings): void;
  /** Join/update the club (a non-empty name is membership); null rank leaves. */
  setClub(name: string, rank: ClubRankTier | null): void;
  /** Paid-money subscriptions: the Daily Carat Pack validity date (null =
   *  unsubscribed) and/or the Training Pass premium toggle. */
  setSubscriptions(patch: { dailyPack?: string | null; trainingPass?: boolean }): void;
  /** The dated base reading every projection runs forward from. */
  saveSnapshot(snapshot: Snapshot): void;
  /** Rush an event: its discrete payout attributes at `start` instead of `end`. */
  setRushed(eventKey: string, on: boolean): void;
  /** Bookmark an entity (view-only; no money effect). */
  setFavourite(id: string, on: boolean, note?: string): void;
  /** View-identity fields (trainer name/id, oshi) — persisted, fold-inert. */
  patchIdentity(patch: Record<string, unknown>): void;
  /** Ephemeral dev toggle: drop a stream from the fold. Never persisted. */
  setEnabled(streamId: string, on: boolean): void;

  /** Fired once after each recompute. Reads never notify. */
  subscribe(listener: () => void): () => void;
}

export interface CoordinatorOptions {
  /** The bake — frozen game data. The client passes it straight through. */
  bundle: EventsBundle;
  config: ConfigBundle;
  /** Today as a calendar date — the projection origin before a snapshot is set. */
  now: CalendarDate;
  /** Calendar timezone baked instants are bucketed into. */
  timeZone?: string;
  /** Account-state persistence. Defaults to localStorage (in-memory outside a browser). */
  store?: KeyValueStore;
  /** The stream registry; defaults to the full roster. Injectable for tests. */
  streams?: readonly Stream[] | undefined;
}

/** The pull-math constants, read off the baked config (resolve-or-throw). */
function gachaOf(config: ConfigBundle): Gacha {
  const g = config.gacha;
  return { caratsPerPull: g.carats_per_pull, paidDailyPull: g.paid_daily_pull, sparkThreshold: g.spark_threshold };
}

/**
 * Drop account-state claims/rushes whose referent can no longer carry them —
 * rushed events fully past (you can't rush a finished event) and commitments
 * against keys the bake no longer carries (reconcile resolve-or-throws, so a
 * stale claim must be swept, not tolerated). Returns the same document when
 * nothing changed. Run once on load.
 */
function pruneStale(doc: PlanDocument, bundle: EventsBundle, now: CalendarDate, timeZone: string): PlanDocument {
  let next = doc;

  if (doc.rushed) {
    const stillRushable = new Set(bundle.events.filter((ev) => dateStringInTimeZone(ev.end, timeZone) >= now).map((ev) => ev.key));
    const kept: NonNullable<PlanDocument["rushed"]> = {};
    let dropped = false;
    for (const [key, instant] of Object.entries(doc.rushed)) {
      if (stillRushable.has(key)) kept[key] = instant;
      else dropped = true;
    }
    if (dropped) {
      next = { ...next };
      if (Object.keys(kept).length > 0) next.rushed = kept;
      else delete next.rushed; // omit, don't store empty
    }
  }

  if (doc.commitments) {
    const known = new Set(bundle.events.map((ev) => ev.key));
    const kept: NonNullable<PlanDocument["commitments"]> = {};
    let dropped = false;
    for (const [key, pity] of Object.entries(doc.commitments)) {
      if (known.has(key)) kept[key] = pity;
      else dropped = true;
    }
    if (dropped) {
      next = next === doc ? { ...next } : next;
      if (Object.keys(kept).length > 0) next.commitments = kept;
      else delete next.commitments;
    }
  }

  return next;
}

/** One derivation's outputs — swapped whole on every write (immutable value). */
interface Derived {
  world: SettledEvent[];
  projection: Projection;
  available: Map<string, ResourceVector>;
}

export function createCoordinator(options: CoordinatorOptions): Coordinator {
  const { bundle, config, now } = options;
  const timeZone = options.timeZone ?? UTC_TIME_ZONE;
  const store = options.store ?? defaultStore();
  const registry = buildRegistry(options.streams ?? DEFAULT_STREAMS, bundle);
  const gacha = gachaOf(config);

  const loaded = load(store);
  let doc = pruneStale(loaded.doc, bundle, now, timeZone);
  if (doc !== loaded.doc) save(doc, store);

  const toggles = new Map<string, boolean>(registry.streams.map((s) => [s.id, true]));
  const listeners = new Set<() => void>();

  function derive(): Derived {
    // ctx — account state resolved once, frozen for this fold's duration.
    const after: CalendarDate = doc.snapshot?.date ? cal(doc.snapshot.date) : now;
    const base = doc.snapshot?.resources ?? {};
    const rushed = new Set(Object.keys(doc.rushed ?? {}));
    const routed = registry.route(bundle);
    const baseCtx = {
      bundle,
      config,
      timeZone,
      after,
      play: resolvePlayStyle(doc.config).settings,
      clubRank: resolveClub(doc.config)?.rank ?? null,
      dailyPack: resolveDailyPack(doc.config),
      trainingPass: resolveTrainingPass(doc.config),
    };

    // union = the settled world: each enabled stream's slice, mutually anonymous.
    const tagged: TaggedEvents[] = [];
    for (const stream of registry.streams) {
      if (toggles.get(stream.id) === false) continue; // ephemeral dev isolation
      const ctx: StreamCtx = { ...baseCtx, owned: routed.get(stream.id) ?? [] };
      if (!stream.enabled(ctx)) continue; // presence, not pricing
      tagged.push({ stream: stream.id, events: stream.events(ctx) });
    }
    const world = tagged.flatMap((t) => t.events);
    const byKey = new Map<string, SettledEvent>();
    for (const event of world) {
      if (byKey.has(event.key)) throw new Error(`settled world: duplicate key "${event.key}"`);
      byKey.set(event.key, event);
    }

    // fold → P_income → reconcile → P_final. Money derivation exists once.
    const income = deriveEmissions(tagged, after, rushed);
    const pIncome = foldIncome({ resources: base }, income);
    const tail = reconcile(doc.commitments ?? {}, byKey, pIncome.series.balanceAt, gacha, after);
    const pFinal = foldIncome({ resources: base }, [...income, { stream: RECONCILIATION_STREAM, emissions: tail.emissions }]);

    return { world, projection: pFinal, available: tail.available };
  }

  let current = derive();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  /** The one write path: patch, persist, re-derive, notify. Every mutator is
   *  sugar over this (commit pity ≡ change a slider — same operation). */
  function update(patch: Partial<Pick<PlanDocument, "snapshot" | "config" | "commitments" | "favourites" | "rushed">>): void {
    doc = { ...doc, ...patch };
    save(doc, store);
    current = derive();
    notify();
  }

  function patchIdentitySection(patch: Record<string, unknown>): void {
    const cfg = doc.config ?? {};
    const identity = cfg["identity"];
    const prior = typeof identity === "object" && identity !== null && !Array.isArray(identity) ? (identity as Record<string, unknown>) : {};
    update({ config: { ...cfg, identity: { ...prior, ...patch } } });
  }

  return {
    settledEvents: () => current.world,
    projection: () => current.projection,
    balanceAt: (date) => current.projection.series.balanceAt(date),
    availableFor: (eventKey) => current.available.get(eventKey),
    document: () => doc,
    streams: () => registry.streams.map((s) => ({ id: s.id, enabled: toggles.get(s.id) !== false })),
    recovered: () => loaded.recovered,

    commit(eventKey, pity) {
      const next = { ...(doc.commitments ?? {}) };
      if (pity > 0) next[eventKey] = pity;
      else delete next[eventKey]; // 0 clears — sparse by construction
      update({ commitments: next });
    },
    setPlay(key, settings) {
      patchIdentitySection({ playStyleKey: key, playStyleSettings: settings });
    },
    setClub(name, rank) {
      if (rank === null || !name) patchIdentitySection({ clubName: "" });
      else patchIdentitySection({ clubName: name, clubRank: rank });
    },
    setSubscriptions(patch) {
      const cfg = { ...(doc.config ?? {}) };
      if ("dailyPack" in patch) {
        if (patch.dailyPack) cfg["dailyPack"] = patch.dailyPack;
        else delete cfg["dailyPack"];
      }
      if ("trainingPass" in patch) {
        if (patch.trainingPass) cfg["trainingPass"] = true;
        else delete cfg["trainingPass"];
      }
      update({ config: cfg });
    },
    saveSnapshot(snapshot) {
      update({ snapshot });
    },
    setRushed(eventKey, on) {
      const next = { ...(doc.rushed ?? {}) };
      if (on) next[eventKey] = new Date().toISOString(); // action timestamp, raw UTC
      else delete next[eventKey];
      update({ rushed: next });
    },
    setFavourite(id, on, note) {
      const next = { ...(doc.favourites ?? {}) };
      if (on) next[id] = note ? { note } : {}; // never { note: "" }
      else delete next[id];
      update({ favourites: next });
    },
    patchIdentity: patchIdentitySection,
    setEnabled(streamId, on) {
      if (!toggles.has(streamId)) return; // unknown stream — nothing to toggle
      toggles.set(streamId, on);
      current = derive();
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
