/**
 * Persistence (pillar 1): stores the user's inputs and nothing derived. Pure
 * `core/`, headless — it reads and writes a versioned document, full stop, and
 * knows nothing about the UI or the projection engine. Wiring it to state (e.g. a
 * debounced autosave) is a thin coordinator's job. See docs/frontend/persistence.md.
 *
 * Reading is a pipeline, not a bare `JSON.parse`:
 *   read raw → parse (guarded) → version gate → ordered migrations → validate
 * On any failure the document is preserved and the app degrades: the raw blob is
 * stashed under a backup key, a clean document is returned, and `recovered` is
 * set so the coordinator can surface a visible "couldn't read your saved plan"
 * notice. We never throw into a blank app and never silently discard intent.
 */

import { CURRENT_VERSION, emptyDocument } from "./document.ts";
import type { PlanDocument } from "./document.ts";
import { backup, defaultStore, DOCUMENT_KEY } from "./storage.ts";
import type { KeyValueStore } from "./storage.ts";
import { isVersioned, validateDocument } from "./validate.ts";

export type { PlanDocument } from "./document.ts";
export { emptyDocument } from "./document.ts";

/**
 * Ordered migration chain. `migrations[n]` upgrades a version-`n` document to
 * version `n+1`; the chain is applied in sequence until the document is current.
 * Empty while CURRENT_VERSION is 1 — the structure is here so adding a shape
 * change later is a pure, isolated `(old) => new` function, never a rewrite.
 */
const migrations: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {};

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

export interface LoadResult {
  doc: PlanDocument;
  /** True when an unreadable save was stashed and we started clean — show the notice. */
  recovered: boolean;
  /** The key the unreadable blob was stashed under, present only when `recovered`. */
  backupKey?: string;
}

/**
 * Read and return the stored plan, or a clean document for a first-time user.
 * Fail-soft: an unreadable/unmigratable blob is stashed and a clean document is
 * returned with `recovered: true`.
 */
export function load(store: KeyValueStore = defaultStore()): LoadResult {
  const raw = store.read(DOCUMENT_KEY);
  if (raw === null) return { doc: emptyDocument(), recovered: false };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isVersioned(parsed)) throw new Error("not a recognisable plan document");
    if (parsed.version > CURRENT_VERSION) throw new Error(`document version ${parsed.version} is newer than this app understands`);
    const migrated = runMigrations({ ...parsed });
    return { doc: validateDocument(migrated), recovered: false };
  } catch (err) {
    console.error("persistence: could not read saved plan, starting clean", err);
    const backupKey = backup(store, raw);
    return { doc: emptyDocument(), recovered: true, backupKey };
  }
}

/** Persist the document. Always current-versioned on write. */
export function save(doc: PlanDocument, store: KeyValueStore = defaultStore()): void {
  store.write(DOCUMENT_KEY, JSON.stringify({ ...doc, version: CURRENT_VERSION }));
}
