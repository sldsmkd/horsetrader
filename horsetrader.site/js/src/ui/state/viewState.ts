/**
 * The discrete view-state store: ephemeral UI state that *many* views care about
 * and that changes *rarely* — which surface is open, the current selection, the
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

import type { BannerKind } from "../select/aboveLane.ts";

export interface ViewState {
  /** The selected entity id (a banner, a favourite), or `null`. */
  selection: string | null;
  /** The current search query; the empty string when search is idle. */
  search: string;
  /** The open member of the RIGHT surface group (`"resources"`),
   *  or `null`. Surfaces split into a left group (the identity machine, which
   *  owns its own state — not here) and a right group (this); each holds at most
   *  one surface + its children, and the two groups are independent — a left and
   *  a right surface can be open at once, but opening a right surface closes the
   *  other right one. */
  right: string | null;
  /** Whether the balance editor modal is up over the Resources surface. Only
   *  meaningful while `right === "resources"`; the editor is a write transaction
   *  that locks the read surface behind it (feedback_shield_vs_unfold). */
  resourcesEditing: boolean;
  /** The banner key whose commit dossier is up, or `null`. A modal like the
   *  balance editor — spawned at source from the banner readout — so it is modal
   *  to every other spawnable window (feedback_shield_vs_unfold). Independent of
   *  the left/right surface groups; the timeline behind it stays live. */
  committing: string | null;
  /** Whether the Cloud provider modal is up (connect / disconnect / switch). A modal
   *  like the others — spawned from the trainer card's Cloud button, modal to every
   *  spawnable window, the timeline behind it stays live (feedback_shield_vs_unfold). */
  cloudConnecting: boolean;
  /** The trainee/support atom whose card detail surface is up, or `null`. A modal
   *  like the others — spawned at source (today the commit dossier's featured cards),
   *  modal to every spawnable window (twinkle-monthly/step-1-card-surface.md). */
  cardDetail: { kind: BannerKind; id: string } | null;
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
  right: null,
  resourcesEditing: false,
  committing: null,
  cloudConnecting: false,
  cardDetail: null,
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
