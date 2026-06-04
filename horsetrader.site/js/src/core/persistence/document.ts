/**
 * The persisted plan document: the user's *inputs only*, never anything
 * derived (per-banner totals, the resource curve, the minimap line are all
 * recomputed by projection — see docs/frontend/persistence.md).
 *
 * The document is versioned and migratable. Field-level schemas of the four
 * sections are intentionally minimal/structural for now — they settle as the
 * projection engine and UI land. The machinery that reads, validates, migrates
 * and stores this document is the contract; the exact field lists are not yet.
 */

/** Bump when the on-disk shape changes; pair with a migration in `migrations`. */
export const CURRENT_VERSION = 1;

/** A resource reading is a keyed vector — free/paid carats, tickets, shards, … */
export type ResourceVector = { [resource: string]: number };

/**
 * A *dated* point-in-time reading of resources — the origin projections run
 * forward from. `date` is the moment the reading was taken.
 */
export interface Snapshot {
  date: string;
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
 * The four sections split by lifecycle. All optional — a fresh user has none.
 * Maps (commitments/favourites) are omitted entirely rather than stored empty.
 */
export interface PlanDocument {
  version: number;
  snapshot?: Snapshot;
  config?: Config;
  commitments?: Commitments;
  favourites?: Favourites;
}

/** A clean document for a first-time user or after a fail-soft recovery. */
export function emptyDocument(): PlanDocument {
  return { version: CURRENT_VERSION };
}
