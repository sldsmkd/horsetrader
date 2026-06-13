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
  /** The selected entity id (a banner, a favourite), or `null`. */
  selection: string | null;
  /** The current search query; the empty string when search is idle. */
  search: string;
  /** Whether the bookmarks drawer is expanded. Layer-2 chrome, independent of
   *  the surface groups — the drawer coexists with an open surface (not modal). */
  bookmarks: boolean;
  /** Which face the Favourites/Planner drawer is showing. */
  bookmarksFace: "favourites" | "planner";
  /** The open member of the RIGHT surface group (`"resources"` | `"tazuna"`),
   *  or `null`. Surfaces split into a left group (the identity machine, which
   *  owns its own state — not here) and a right group (this); each holds at most
   *  one surface + its children, and the two groups are independent — a left and
   *  a right surface can be open at once, but opening a right surface closes the
   *  other right one. */
  right: string | null;
  /** Whether the balance editor shield is up over the Resources surface. Only
   *  meaningful while `right === "resources"`; the editor is a write transaction
   *  that suspends the read surface behind it (feedback_shield_vs_unfold). */
  resourcesEditing: boolean;
  /** The banner key whose commit shield is up, or `null`. A shield like the
   *  balance editor — spawned at source from the banner readout — so it is modal
   *  to every other spawnable window (feedback_shield_vs_unfold). Independent of
   *  the left/right surface groups; the timeline behind it stays live. */
  committing: string | null;
}

export interface ViewStore {
  /** The current view-state — read-only; mutate through `set`. */
  get(): Readonly<ViewState>;
  /** Merge a patch and notify subscribers. */
  set(patch: Partial<ViewState>): void;
  /** Register a listener fired after every `set`; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

const INITIAL: ViewState = {
  selection: null,
  search: "",
  bookmarks: false,
  bookmarksFace: "favourites",
  right: null,
  resourcesEditing: false,
  committing: null,
};

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
