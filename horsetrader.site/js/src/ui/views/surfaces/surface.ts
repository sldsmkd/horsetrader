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
  return h(
    "div",
    {
      class: `surface surface--${opts.placement ?? "right"} surface--headerless`,
      attr: { role: "dialog", "aria-label": opts.title },
    },
    h("div", { class: "surface__body" }, opts.body),
  );
}
