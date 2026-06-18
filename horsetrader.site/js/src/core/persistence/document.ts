/**
 * The persisted plan document: the user's *inputs only*, never anything
 * derived (per-banner totals, the resource curve, the minimap line are all
 * recomputed by projection — see docs/frontend/persistence.md).
 *
 * On disk the document is wrapped in a `StoredEnvelope` that splits device-local
 * sync bookkeeping from the syncable plan: `{ local, remote }` (see bottom of
 * file). `remote` IS the `PlanDocument` below — the versioned, migratable,
 * cloud-synced unit; `local` holds only the cloud-rev metadata (etag/dirty) that
 * is meaningless on another device. The trainer's display name lives IN `remote`
 * (config.identity.trainerName) so it syncs — a name that crosses devices is the
 * human-legible "sync worked" signal. The split stays real for the sync meta.
 *
 * The document is versioned and migratable. Field-level schemas of the four
 * sections are intentionally minimal/structural for now — they settle as the
 * projection engine and UI land. The machinery that reads, validates, migrates
 * and stores this document is the contract; the exact field lists are not yet.
 */

/** Bump when the `remote` plan shape changes; pair with a migration in `migrations`. */
export const CURRENT_VERSION = 2;

/** A resource reading is a keyed vector — free/paid carats, tickets, shards, … */
export type ResourceVector = { [resource: string]: number };

/**
 * A point-in-time reading of resources — the origin projections run forward from.
 * `recordedAt` is the full UTC instant the reading was taken (`new Date().toISOString()`,
 * the same action-timestamp shape as [[Rushed]]). Wall-clock time is load-bearing,
 * not cosmetic: the game's daily resets and content drops land at specific times,
 * so *when in the day* a reading was taken decides whether that day's drops are
 * already counted in it. `date` is that instant's UTC calendar day — the
 * daily-granular origin the fold runs from today (see coordinator `fold`); the two
 * stay consistent (`date === recordedAt.slice(0, 10)`).
 */
export interface Snapshot {
  date: string;
  recordedAt: string;
  resources: ResourceVector;
}

/**
 * Slow-changing account settings (ranks, daily pack, weekly-login pattern,
 * monthly flags, whale toggle, display prefs). Kept open: the field list is the
 * UI/config layer's to settle. Game-data *values* never live here — only the
 * user's gating choices (see docs/frontend/projection.md).
 */
export type Config = { [setting: string]: unknown };

/**
 * Per-banner committed pities (the unit of account) — keyed by banner id. The
 * carat cost is *derived* from the pity intent, never stored (see
 * docs/frontend/projection.md).
 */
export type Commitments = { [bannerId: string]: number };

/**
 * A favourited entity. Sparse by construction: a bare favourite is `{}` (the
 * key's presence *is* the fact); a note is added only when the user wrote one.
 * Never `{ note: "" }`.
 */
export interface FavouriteEntry {
  note?: string;
}

/** Favourited entities keyed by ETL stable entity id; absent key ⇒ not a favourite. */
export type Favourites = { [entityId: string]: FavouriteEntry };

/**
 * Rushed events keyed by ETL stable event id → the UTC instant the rush flag was
 * set (`new Date().toISOString()`). The value is an action-timestamp (a record of
 * *when the user chose to rush*), not a timeline date — so it is stored raw UTC
 * and never run through the calendar/timezone mapper. Sparse like favourites: the
 * key's presence *is* the fact; unsetting deletes the key (never `null`/empty).
 */
export type Rushed = { [eventId: string]: string };

/**
 * The sections split by lifecycle. All optional — a fresh user has none.
 * Maps (commitments/favourites/rushed) are omitted entirely rather than stored empty.
 */
export interface PlanDocument {
  version: number;
  snapshot?: Snapshot;
  config?: Config;
  commitments?: Commitments;
  favourites?: Favourites;
  rushed?: Rushed;
}

/** A clean document for a first-time user or after a fail-soft recovery. */
export function emptyDocument(): PlanDocument {
  return { version: CURRENT_VERSION };
}

/**
 * Cloud-sync bookkeeping (Unity) — local-only, never pushed. `etag` is the R2 rev
 * of the last successfully-synced `remote` (the CAS base for the next push); null
 * = never synced. `dirty` = local `remote` has changed since that sync.
 */
export interface SyncMeta {
  etag: string | null;
  dirty: boolean;
}

/**
 * Never-synced, device-local state — deliberately OUTSIDE the syncable `remote`
 * plan. Holds only `sync`, the cloud-rev bookkeeping (the last-synced etag + dirty
 * flag), which is per-device and meaningless elsewhere. The trainer's display name
 * is NOT here — it syncs, so it lives in `remote` (config.identity.trainerName).
 */
export interface LocalState {
  sync?: SyncMeta;
}

/**
 * The on-disk artifact: device-local sync meta beside the syncable plan. `remote`
 * is the exact blob Unity GET/PUTs to R2 — including the trainer's display name,
 * which deliberately syncs (a name appearing on a second device is *the* signal a
 * pull worked). `local` carries only the cloud-rev bookkeeping, which can't travel.
 */
export interface StoredEnvelope {
  local: LocalState;
  remote: PlanDocument;
}

/** A clean envelope for a first-time user or after a fail-soft recovery. */
export function emptyEnvelope(): StoredEnvelope {
  return { local: {}, remote: emptyDocument() };
}
