/**
 * The discrete view-state store: ephemeral UI state that *many* views care about
 * and that changes *rarely* — which overlay is open, the current selection, the
 * search query. It carries a render-triggering `subscribe`, the same one-way
 * pattern as the coordinator (docs/frontend/interaction.md). It is NEVER
 * persisted (it is not a plan input) and is NEVER read back out of the DOM (the
 * DOM is not the source of truth — ui.md principle 7).
 *
 * Deliberately NOT the home for high-frequency transient state (cursor/scrub
 * date, pan offset, hover): that has no broadcast — it is pushed straight to its
 * one or two consumers on the cheap path — so a 60 Hz scrub cannot enter the
 * render path. See the store split in docs/frontend/interaction.md.
 */

export interface ViewState {
  /** The open overlay's id, or `null` when the bare timeline is in front. */
  overlay: string | null;
  /** The selected entity id (a banner, a favourite), or `null`. */
  selection: string | null;
  /** The current search query; the empty string when search is idle. */
  search: string;
  /** Whether the bookmarks drawer is expanded. Layer-2 chrome, independent of
   *  `overlay` — the drawer coexists with an open overlay (it is not modal). */
  bookmarks: boolean;
}

export interface ViewStore {
  /** The current view-state — read-only; mutate through `set`. */
  get(): Readonly<ViewState>;
  /** Merge a patch and notify subscribers. */
  set(patch: Partial<ViewState>): void;
  /** Register a listener fired after every `set`; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

const INITIAL: ViewState = { overlay: null, selection: null, search: "", bookmarks: false };

export function createViewStore(initial: Partial<ViewState> = {}): ViewStore {
  let state: ViewState = { ...INITIAL, ...initial };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
