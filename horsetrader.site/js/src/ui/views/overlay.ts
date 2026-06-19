/**
 * A floating, non-blocking overlay — the shared chrome every floating surface
 * (account, search, plan, …) sits in. It honours ui.md principle 1: it **never
 * captures the timeline's scroll**. There is no input-capturing backdrop; the
 * canvas stays live behind it (the `.overlay-layer` it mounts into is
 * `pointer-events: none`, only the card itself is interactive). Dismiss controls
 * live inside the surface body (Cancel / collapse pill), not in generic window chrome.
 *
 * Pure view: it renders structure and forwards the close intent; it owns no
 * state and reads nothing back out of the DOM.
 */

import "./overlay.css";

import { h } from "../h.ts";

export interface OverlayOpts {
  title: string;
  body: Node;
  placement?: "left" | "right" | "center";
  /** Historical no-op: overlays are always headerless now. Surfaces render their own
   *  title hero and dismiss affordance; `title` is the dialog's accessible name. */
  headerless?: boolean;
  onClose: () => void;
}

export function suspendOverlay(card: HTMLElement): HTMLElement {
  card.classList.add("overlay--suspended");
  card.setAttribute("aria-hidden", "true");
  card.append(h("div", { class: "overlay__modal-shield", attr: { "aria-hidden": "true" } }));
  return card;
}

export function overlay(opts: OverlayOpts): HTMLElement {
  return h(
    "div",
    {
      class: `overlay overlay--${opts.placement ?? "right"} overlay--headerless`,
      attr: { role: "dialog", "aria-label": opts.title },
    },
    h("div", { class: "overlay__body" }, opts.body),
  );
}
