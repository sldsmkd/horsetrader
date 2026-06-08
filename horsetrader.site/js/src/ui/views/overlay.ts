/**
 * A floating, non-blocking overlay — the shared chrome every floating surface
 * (account, search, plan, …) sits in. It honours ui.md principle 1: it **never
 * captures the timeline's scroll**. There is no input-capturing backdrop; the
 * canvas stays live behind it (the `.overlay-layer` it mounts into is
 * `pointer-events: none`, only the card itself is interactive). Dismiss via the
 * close control — the shell decides what "dismiss" does by passing `onClose`.
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
      class: `overlay overlay--${opts.placement ?? "right"}`,
      attr: { role: "dialog", "aria-label": opts.title },
    },
    h(
      "header",
      { class: "overlay__header" },
      h("span", { class: "overlay__title" }, opts.title),
      h(
        "button",
        { class: "overlay__close", attr: { type: "button", "aria-label": "Close" }, on: { click: opts.onClose } },
        "✕",
      ),
    ),
    h("div", { class: "overlay__body" }, opts.body),
  );
}
