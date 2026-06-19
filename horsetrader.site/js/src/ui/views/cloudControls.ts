import "./cloudControls.css";

import { h } from "../h.ts";
import type { AuthState } from "../../core/cloud/index.ts";

export interface CloudControlsOpts {
  auth: AuthState;
  /** Local plan has unsynced edits — the only thing Sync can act on client-side. */
  dirty: boolean;
  /** A sync is in flight (buttons disabled, label flips). */
  syncing: boolean;
  /** Short human outcome of the last sync, or null for none yet. */
  outcome: string | null;
  onCloud: () => void;
  onSync: () => void;
}

function controlButton(label: string, onClick: () => void): HTMLButtonElement {
  return h("button", { class: "cloud-controls__btn", attr: { type: "button" }, on: { click: onClick } }, label);
}

/**
 * The Unity cloud controls — `Cloud` (connect / manage) + `Sync`, on the trainer card
 * between club info and play style. Purely presentational: auth + last-sync state live
 * in the app shell (fetched once), so the trainer card's frequent rebuilds never re-hit
 * `/api/me`. `Cloud` opens the provider shield; `Sync` runs the reconcile, lit only when
 * connected AND there are local changes to send.
 */
export function cloudControls(opts: CloudControlsOpts): HTMLElement {
  const connected = opts.auth.authenticated;

  // Rough placeholder art (emoji) until real icons land — a cloud for the
  // connection, a recycle glyph for sync.
  const cloud = controlButton(connected ? "☁️ Cloud ✓" : "☁️ Cloud", opts.onCloud);
  cloud.title = connected ? "Manage your cloud connection" : "Connect a cloud save";
  cloud.classList.toggle("cloud-controls__btn--connected", connected);

  const sync = controlButton(opts.syncing ? "🔄 Syncing…" : "🔄 Sync", opts.onSync);
  sync.disabled = !connected || !opts.dirty || opts.syncing;
  sync.title = !connected
    ? "Connect a cloud first"
    : opts.dirty
      ? "Sync your plan with the cloud"
      : "Nothing to sync — no local changes since the last sync";

  const row = h("div", { class: "cloud-controls__row" }, cloud, sync);
  return h(
    "div",
    { class: "cloud-controls" },
    row,
    opts.outcome ? h("p", { class: "cloud-controls__status" }, opts.outcome) : null,
  );
}
