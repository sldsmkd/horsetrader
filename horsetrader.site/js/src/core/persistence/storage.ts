/**
 * The one place that knows the storage mechanism. A cleanliness boundary, not a
 * pluggable-backend abstraction: synchronous and simple. Sizing (see
 * docs/frontend/persistence.md) confirms localStorage is comfortably sufficient,
 * so there is no async ceremony for a hypothetical IndexedDB swap — if a backend
 * change ever becomes real, this module is the single place to change.
 *
 * The backend is a tiny key/value interface so headless tests (and any
 * non-browser context) can run against an in-memory store; in the browser it is
 * localStorage.
 */

/** The single document key. One document, one key — not the old scattered `ht_*`. */
export const DOCUMENT_KEY = "horsetrader.plan";

/** Prefix for stashed unreadable blobs; suffixed with a timestamp so we never clobber. */
const BACKUP_PREFIX = "horsetrader.plan.backup.";

export interface KeyValueStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

function localStorageStore(): KeyValueStore {
  return {
    read: (key) => localStorage.getItem(key),
    write: (key, value) => localStorage.setItem(key, value),
  };
}

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    read: (key) => map.get(key) ?? null,
    write: (key, value) => {
      map.set(key, value);
    },
  };
}

/** localStorage in the browser; an in-memory fallback anywhere it is absent (tests). */
export function defaultStore(): KeyValueStore {
  return typeof localStorage !== "undefined" ? localStorageStore() : memoryStore();
}

export { memoryStore };

/**
 * Stash a raw blob we could not read under a fresh, timestamped backup key, so a
 * corrupt or stale save is preserved rather than overwritten. Returns the key.
 */
export function backup(store: KeyValueStore, raw: string): string {
  const key = `${BACKUP_PREFIX}${Date.now()}`;
  store.write(key, raw);
  return key;
}
