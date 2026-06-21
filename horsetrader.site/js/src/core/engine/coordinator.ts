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
import type { Snapshot, SyncMeta } from "../persistence/document.ts";
import type { LocalState, PlanDocument } from "../persistence/index.ts";
import { load, save } from "../persistence/index.ts";
import { normaliseNote, normaliseName, normaliseCount, resourceCap, TRAINER_NAME_MAX, CLUB_NAME_MAX } from "../persistence/validate.ts";
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
  /** The persisted account state (read-only view) — the syncable `remote` plan. */
  document(): PlanDocument;
  /** The trainer's display name (lives in the synced plan now), "" when unset. */
  username(): string;
  /** Cloud-sync bookkeeping: last-synced rev + whether local has diverged since. */
  syncMeta(): SyncMeta;
  /** Every stream and its ephemeral toggle state. */
  streams(): StreamState[];
  /** True when the stored account state was unreadable and a clean one began. */
  recovered(): boolean;

  // ── Write: typed intent, one private path ─────────────────────────────────
  /** Raise/adjust a claim against an event (0 clears it). `usePaid` opts the claim
   *  into spending owned paid carats at full price beyond the daily window (#65). */
  commit(eventKey: string, pity: number, usePaid: boolean): void;
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
  setFavourite(id: string, on: boolean): void;
  /** Write the free-text note on a subject (a trainee/support stable id), or clear
   *  it with an empty/blank string. The text is normalised (trimmed, tweet-capped,
   *  control-chars stripped) on the way in (Twinkle Monthly · The Interview). */
  setNote(subjectId: string, text: string): void;
  /** View-identity fields (oshi, club) — persisted in the plan, fold-inert. */
  patchIdentity(patch: Record<string, unknown>): void;
  /** Set the trainer's display name (synced plan state; "" clears it). */
  setUsername(name: string): void;
  /** Record a successful sync: adopt the new cloud rev, clear `dirty`. Local-only. */
  markSynced(etag: string | null): void;
  /** Forget the cloud baseline (etag→null) after a disconnect deleted the cloud save —
   *  the held rev now points at nothing, so a reconnect must re-create from scratch.
   *  `dirty` follows whether local still has a plan to push up. Local-only. */
  forgetCloud(): void;
  /**
   * Replace the local plan with a pulled cloud `remote` and record its rev. NAIVE:
   * adopts unconditionally — the dirty/conflict gate is the next flow to design
   * (the site isn't released; data loss is acceptable while we shake this out).
   */
  adoptRemote(remote: PlanDocument, etag: string | null): void;
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

/** The trainer's display name out of the synced plan (config.identity.trainerName),
 *  or "" when unset. It rides in `remote` so it syncs (the "sync worked" signal). */
function trainerNameOf(doc: PlanDocument): string {
  const identity = doc.config?.["identity"];
  const name =
    typeof identity === "object" && identity !== null && !Array.isArray(identity)
      ? (identity as Record<string, unknown>)["trainerName"]
      : undefined;
  return typeof name === "string" && name.trim() ? name : "";
}

/** Does the plan hold anything worth syncing? Judged by CONTENT — commitments,
 *  favourites, rushed flags, a snapshot, or a trainer name — not mere object
 *  presence, so a fresh empty plan does NOT read dirty (no spurious first-connect
 *  push from a blank browser). */
function planHasContent(doc: PlanDocument): boolean {
  return (
    Object.keys(doc.commitments ?? {}).length > 0 ||
    Object.keys(doc.favourites ?? {}).length > 0 ||
    Object.keys(doc.rushed ?? {}).length > 0 ||
    Object.keys(doc.notes ?? {}).length > 0 ||
    doc.snapshot != null ||
    trainerNameOf(doc) !== ""
  );
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
  let doc = pruneStale(loaded.envelope.remote, bundle, now, timeZone);
  // `sync` is normalised present so every persist carries it (never-synced = etag null).
  // A never-synced plan that ALREADY holds content loads DIRTY, so the first connect can
  // push it up: otherwise Sync stays disabled until an edit, and a populated browser can
  // never seed an empty cloud — the reported "empty browser can't pull until the
  // populated one is edited" chain. Emptiness is content-judged (planHasContent).
  let local: LocalState = {
    ...loaded.envelope.local,
    sync: loaded.envelope.local.sync ?? { etag: null, dirty: planHasContent(doc) },
  };
  const persist = (): void => save({ local, remote: doc }, store);
  // Write back once on load if the stored shape was upgraded (legacy→envelope or a
  // remote-version migration) or stale entries were pruned — so the migration is
  // durable, not deferred to the next mutation.
  if (loaded.migrated || doc !== loaded.envelope.remote) persist();

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
  function update(patch: Partial<Pick<PlanDocument, "snapshot" | "config" | "commitments" | "favourites" | "rushed" | "notes">>): void {
    doc = { ...doc, ...patch };
    // Any change to the syncable plan diverges it from the last-synced cloud rev.
    local = { ...local, sync: { etag: local.sync?.etag ?? null, dirty: true } };
    persist();
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
    username: () => trainerNameOf(doc),
    syncMeta: () => local.sync ?? { etag: null, dirty: false },
    streams: () => registry.streams.map((s) => ({ id: s.id, enabled: toggles.get(s.id) !== false })),
    recovered: () => loaded.recovered,

    commit(eventKey, pity, usePaid) {
      const next = { ...(doc.commitments ?? {}) };
      // Store the dict form only when the paid-spend flag is on; a bare commitment
      // stays the flat integer (sparse by construction, like favourites/rushed).
      if (pity > 0) next[eventKey] = usePaid ? { number: pity, use_paid: true } : pity;
      else delete next[eventKey]; // 0 clears
      update({ commitments: next });
    },
    setPlay(key, settings) {
      patchIdentitySection({ playStyleKey: key, playStyleSettings: settings });
    },
    setClub(name, rank) {
      const clean = normaliseName(name, CLUB_NAME_MAX).trim(); // one path with the trainer name (allow-list + cap)
      if (rank === null || !clean) patchIdentitySection({ clubName: "" });
      else patchIdentitySection({ clubName: clean, clubRank: rank });
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
      // Normalise every transcribed count to its resource width (non-negative int,
      // capped) at the write seam — one path with the persistence ingress.
      const resources: ResourceVector = {};
      for (const [k, v] of Object.entries(snapshot.resources)) resources[k] = normaliseCount(v, resourceCap(k));
      update({ snapshot: { ...snapshot, resources } });
    },
    setRushed(eventKey, on) {
      const next = { ...(doc.rushed ?? {}) };
      if (on) next[eventKey] = new Date().toISOString(); // action timestamp, raw UTC
      else delete next[eventKey];
      update({ rushed: next });
    },
    setFavourite(id, on) {
      const next = { ...(doc.favourites ?? {}) };
      if (on) next[id] = {}; // bare: the key's presence is the fact (notes are their own layer)
      else delete next[id];
      update({ favourites: next });
    },
    setNote(subjectId, text) {
      const note = normaliseNote(text);
      const next = { ...(doc.notes ?? {}) };
      if (note) next[subjectId] = note; // normalised: trimmed, capped, control-chars stripped
      else delete next[subjectId]; // empty clears (sparse, never "")
      update({ notes: next });
    },
    patchIdentity: patchIdentitySection,
    setUsername(name) {
      // The display name lives in the synced plan (config.identity.trainerName), so
      // a change diverges the cloud rev like any plan edit — route it through the
      // identity patch (update → dirty → re-derive → notify). Empty clears it.
      patchIdentitySection({ trainerName: normaliseName(name, TRAINER_NAME_MAX).trim() }); // allow-list + cap; "" clears
    },
    markSynced(etag) {
      // A clean push/pull: the local plan now matches this cloud rev. Local-only,
      // no re-derive (the plan itself didn't change).
      local = { ...local, sync: { etag, dirty: false } };
      persist();
      notify();
    },
    forgetCloud() {
      // Disconnect deleted the cloud blob; the held etag is now a dangling rev. Drop it
      // so the next connect pushes a fresh create (base ø) rather than a doomed If-Match.
      // Logically dirty whenever local still has content (resolution.md null-base rule).
      local = { ...local, sync: { etag: null, dirty: planHasContent(doc) } };
      persist();
      notify();
    },
    adoptRemote(remote, etag) {
      // Pull-adopt: swap the plan wholesale, prune stale entries, record the rev.
      doc = pruneStale(remote, bundle, now, timeZone);
      local = { ...local, sync: { etag, dirty: false } };
      persist();
      current = derive();
      notify();
    },
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
