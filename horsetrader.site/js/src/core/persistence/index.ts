/**
 * Persistence (pillar 1): stores the user's inputs and nothing derived. Pure
 * `core/`, headless — it reads and writes a versioned document, full stop, and
 * knows nothing about the UI or the projection engine. Wiring it to state (e.g. a
 * debounced autosave) is a thin coordinator's job. See docs/frontend/persistence.md.
 *
 * The on-disk artifact is a `StoredEnvelope` = `{ local, remote }`: never-synced
 * device state (username, future sync metadata) beside the syncable `remote`
 * plan. `remote` is the exact blob Unity GET/PUTs to R2 — the structural split
 * means the cloud never holds the username, with no per-push masking.
 *
 * Reading is a pipeline, not a bare `JSON.parse`:
 *   read raw → parse (guarded) → shape branch (envelope | legacy flat)
 *            → version gate → ordered migrations → validate
 * On any failure the document is preserved and the app degrades: the raw blob is
 * stashed under a backup key, a clean envelope is returned, and `recovered` is
 * set so the coordinator can surface a visible "couldn't read your saved plan"
 * notice. We never throw into a blank app and never silently discard intent.
 */

import { CURRENT_VERSION, emptyEnvelope } from "./document.ts";
import type { PlanDocument, StoredEnvelope } from "./document.ts";
import { backup, defaultStore, DOCUMENT_KEY } from "./storage.ts";
import type { KeyValueStore } from "./storage.ts";
import { isVersioned, validateDocument, validateLocal } from "./validate.ts";

export type { PlanDocument, LocalState, StoredEnvelope } from "./document.ts";
export { emptyDocument, emptyEnvelope } from "./document.ts";
/** Egress shape gate — assert a plan is plausibly ours before a network push (Unity). */
export { assertPlausiblePlan } from "./validate.ts";

/** A plain object guard (a local copy keeps this module free of validate's internals). */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Ordered migration chain over the `remote` plan. `migrations[n]` upgrades a
 * version-`n` plan to version `n+1`; the chain is applied until the plan is
 * current. Each step is a pure, isolated `(old) => new` — never a rewrite.
 *
 * v1 → v2 (Unity): retire the Trainer ID. The display name (`trainerName`) and the
 * now-deleted Trainer ID both lived under `config.identity`; v2 strips only the
 * Trainer ID. `trainerName` STAYS in the synced plan — it travels to the cloud and
 * is the human-legible "sync worked" signal (the brief local-only era is reversed;
 * a save that stashed it in `local.username` is folded back into `remote` by `load`).
 */
const migrations: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {
  1: (doc) => {
    const next: Record<string, unknown> = { ...doc, version: 2 };
    const config = next["config"];
    if (isObject(config) && isObject(config["identity"])) {
      const identity = { ...config["identity"] };
      delete identity["trainerId"]; // retired; trainerName is kept and syncs
      const cfg = { ...config };
      if (Object.keys(identity).length) cfg["identity"] = identity;
      else delete cfg["identity"];
      if (Object.keys(cfg).length) next["config"] = cfg;
      else delete next["config"];
    }
    return next;
  },
};

function runMigrations(doc: Record<string, unknown>): Record<string, unknown> {
  let current = doc;
  while ((current["version"] as number) < CURRENT_VERSION) {
    const from = current["version"] as number;
    const migrate = migrations[from];
    if (!migrate) throw new Error(`no migration from version ${from}`);
    current = migrate(current);
    if ((current["version"] as number) <= from) throw new Error(`migration from ${from} did not advance version`);
  }
  return current;
}

/**
 * Migrate + validate a raw plan blob into a current `PlanDocument` (the `remote`
 * half). Throws on anything not recognisably our plan, or a version newer than we
 * understand — so an untrusted pulled cloud blob can't be adopted as-is. The cloud
 * sync layer reuses this as its ingress gate (a pulled `remote` IS this shape).
 */
export function normaliseRemotePlan(raw: unknown): PlanDocument {
  if (!isVersioned(raw)) throw new Error("not a recognisable plan document");
  if (raw.version > CURRENT_VERSION) throw new Error(`document version ${raw.version} is newer than this app understands`);
  return validateDocument(runMigrations({ ...raw }));
}

export interface LoadResult {
  envelope: StoredEnvelope;
  /** True when an unreadable save was stashed and we started clean — show the notice. */
  recovered: boolean;
  /** The key the unreadable blob was stashed under, present only when `recovered`. */
  backupKey?: string;
  /**
   * True when the on-disk shape was upgraded (legacy flat doc → envelope, or the
   * `remote` plan migrated to a newer version). The caller should persist once on
   * load so the migration is durable — otherwise the old blob lingers until the
   * next mutation.
   */
  migrated: boolean;
}

/** Did this stored remote need migrating to reach the current plan version? */
function remoteNeedsMigration(remoteRaw: unknown): boolean {
  return isObject(remoteRaw) && typeof remoteRaw["version"] === "number" && remoteRaw["version"] < CURRENT_VERSION;
}

/**
 * Fold a legacy `local.username` (the brief local-only era) back into the remote
 * plan's `config.identity.trainerName`, so the display name re-joins the synced
 * plan. A no-op when there's no local username or the remote already names a
 * trainer. Returns the (possibly rebuilt) remote and whether it moved one — the
 * latter drives a durable rewrite on load.
 */
function foldLegacyUsername(localRaw: unknown, remoteRaw: unknown): { remote: unknown; moved: boolean } {
  const name = isObject(localRaw) && typeof localRaw["username"] === "string" ? localRaw["username"].trim() : "";
  if (!name || !isObject(remoteRaw)) return { remote: remoteRaw, moved: false };
  const cfg = isObject(remoteRaw["config"]) ? remoteRaw["config"] : {};
  const identity = isObject(cfg["identity"]) ? cfg["identity"] : {};
  if (typeof identity["trainerName"] === "string" && identity["trainerName"].trim()) {
    return { remote: remoteRaw, moved: false }; // remote already names a trainer — keep it
  }
  return {
    remote: { ...remoteRaw, config: { ...cfg, identity: { ...identity, trainerName: name } } },
    moved: true,
  };
}

/**
 * Read and return the stored envelope, or a clean one for a first-time user.
 * Fail-soft: an unreadable/unmigratable blob is stashed and a clean envelope is
 * returned with `recovered: true`.
 */
export function load(store: KeyValueStore = defaultStore()): LoadResult {
  const raw = store.read(DOCUMENT_KEY);
  if (raw === null) return { envelope: emptyEnvelope(), recovered: false, migrated: false };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) throw new Error("not a recognisable plan document");

    // New shape: an envelope carrying its own `remote` plan.
    if ("remote" in parsed) {
      const local = validateLocal(parsed["local"]); // sync meta only — username no longer rides here
      // Username re-sync: a save from the brief local-only era stashes the display
      // name in `local.username`. Fold it back into the synced remote plan so it
      // reaches the cloud; validateLocal has already dropped it from `local`.
      const folded = foldLegacyUsername(parsed["local"], parsed["remote"]);
      const migrated = remoteNeedsMigration(parsed["remote"]) || folded.moved;
      return { envelope: { local, remote: normaliseRemotePlan(folded.remote) }, recovered: false, migrated };
    }

    // Legacy flat v1 doc: the plan lived at top level with identity folded into
    // config. `trainerName` now SYNCS, so it stays in the plan (the migration strips
    // only the retired Trainer ID) — no lift to local. Reshaping flat → envelope IS
    // a migration, so always flag it for a durable rewrite.
    return { envelope: { local: {}, remote: normaliseRemotePlan(parsed) }, recovered: false, migrated: true };
  } catch (err) {
    console.error("persistence: could not read saved plan, starting clean", err);
    const backupKey = backup(store, raw);
    return { envelope: emptyEnvelope(), recovered: true, backupKey, migrated: false };
  }
}

/** Persist the envelope. The `remote` plan is always current-versioned on write. */
export function save(envelope: StoredEnvelope, store: KeyValueStore = defaultStore()): void {
  const out: StoredEnvelope = {
    local: envelope.local,
    remote: { ...envelope.remote, version: CURRENT_VERSION },
  };
  store.write(DOCUMENT_KEY, JSON.stringify(out));
}
