/**
 * A floating, non-blocking surface — the shared chrome every floating surface
 * (account, search, plan, …) sits in. It honours ui.md principle 1: it **never
 * captures the timeline's scroll**. There is no input-capturing backdrop; the
 * canvas stays live behind it (the `.surface-layer` it mounts into is
 * `pointer-events: none`, only the card itself is interactive). Dismiss controls
 * live inside the surface body (Cancel / collapse pill), not in generic window chrome.
 *
 * Pure view: it renders structure and forwards the close intent; it owns no
 * state and reads nothing back out of the DOM.
 */

import "./surface.css";

import { h } from "../../h.ts";

export interface SurfaceOpts {
  title: string;
  body: Node;
  placement?: "left" | "right" | "center";
  /** Historical no-op: surfaces are always headerless now. Surfaces render their own
   *  title hero and dismiss affordance; `title` is the dialog's accessible name. */
  headerless?: boolean;
  onClose: () => void;
}

/** Marker stamped on a surface's *dismiss* affordance — the way out the Escape key
 *  reaches for. The topmost surface is keyboard-dismissable iff its body carries one of
 *  these. */
export const SURFACE_DISMISS_ATTR = "data-surface-dismiss";

/** A dismiss button that also exposes a live guard to the Escape handler. */
interface DismissButton extends HTMLButtonElement {
  /** May Escape activate this dismiss *right now*? Absent ⇒ always (a viewer's Close,
   *  which has nothing to lose). An editor sets it to gate on pending state, so Esc
   *  abandons a pristine editor but is inert while a decision is waiting to be committed. */
  escSafe?: () => boolean;
}

function dismissButton(opts: { class: string; onDismiss: () => void; label: string; escSafe?: () => boolean }): HTMLButtonElement {
  const btn = h(
    "button",
    { class: opts.class, attr: { type: "button", [SURFACE_DISMISS_ATTR]: "" }, on: { click: opts.onDismiss } },
    opts.label,
  ) as DismissButton;
  if (opts.escSafe) btn.escSafe = opts.escSafe;
  return btn;
}

/** A viewer's *Close* — the neutral dismiss of a read-only surface (the Desk, a card
 *  detail). Always Esc-dismissable: there is no pending state to discard. */
export function surfaceClose(opts: { class: string; onClose: () => void; label?: string }): HTMLButtonElement {
  return dismissButton({ class: opts.class, onDismiss: opts.onClose, label: opts.label ?? "Close" });
}

/** An editor's *Cancel* — abandons edits/selection. Esc reaches it only when `escSafe`
 *  reports nothing pending (a pristine editor); with a decision waiting to be committed
 *  Esc is inert and the button stays the explicit, deliberate way out. Omit `escSafe`
 *  for a stateless surface that is always safe to back out of. */
export function surfaceCancel(opts: { class: string; onCancel: () => void; label?: string; escSafe?: () => boolean }): HTMLButtonElement {
  return dismissButton({
    class: opts.class,
    onDismiss: opts.onCancel,
    label: opts.label ?? "Cancel",
    ...(opts.escSafe ? { escSafe: opts.escSafe } : {}),
  });
}

/** Resolve which dismiss button Escape should activate, given the surface layers in
 *  paint order topmost-first (the modal layer above the chrome rail). Escape acts on the
 *  topmost surface only: the first non-empty layer's last child. Returns its dismiss
 *  button when one is present *and* its `escSafe` guard allows; otherwise null — Escape
 *  never falls through a surface to dismiss one painted beneath it. */
export function escDismissTarget(...layersTopFirst: ParentNode[]): HTMLButtonElement | null {
  for (const layer of layersTopFirst) {
    const top = layer.lastElementChild;
    if (!top) continue; // empty layer — look beneath it
    const btn = top.querySelector<DismissButton>(`[${SURFACE_DISMISS_ATTR}]`);
    if (!btn) return null; // topmost surface isn't Esc-dismissable; don't reach past it
    return (btn.escSafe?.() ?? true) ? btn : null;
  }
  return null;
}

export function suspendSurface(card: HTMLElement): HTMLElement {
  card.classList.add("surface--locked");
  card.setAttribute("aria-hidden", "true");
  card.append(h("div", { class: "surface__lock", attr: { "aria-hidden": "true" } }));
  return card;
}

/** Suspend a surface for the modality lock (grand-masters/byerley-turk.md). A composite
 *  surface — the playstyle `.surface-book` — is a `pointer-events: none` wrapper, so the
 *  scrim only blocks if it lands on each inner card; a plain surface suspends directly. */
export function lockSurface(node: HTMLElement): void {
  const inner = node.querySelectorAll<HTMLElement>(":scope > .surface");
  if (inner.length) inner.forEach((card) => suspendSurface(card));
  else suspendSurface(node);
}

export function surface(opts: SurfaceOpts): HTMLElement {
  // "center" is the human-facing placement; the modal *trait* it carries is the
  // `surface--modal` marker the router (app.ts) + CSS key on — one class for both,
  // per the modality design (centred placement ⇒ modal). left/right pass through.
  const variant = opts.placement === "center" ? "modal" : (opts.placement ?? "right");
  return h(
    "div",
    {
      class: `surface surface--${variant} surface--headerless`,
      attr: { role: "dialog", "aria-label": opts.title },
    },
    h("div", { class: "surface__body" }, opts.body),
  );
}
