/**
 * Tazuna: help and explanations. Not yet scoped — this is a dummy surface sized
 * like a real side panel so the interaction flows (open/close, shield suspend,
 * mutual exclusivity with the trainer card) can be exercised before the content
 * exists. Swap the placeholder body for the real thing when it lands.
 */

import "./tazunaSurface.css";

import { h } from "../h.ts";

export function tazunaSurface(): HTMLElement {
  return h(
    "section",
    { class: "tazuna-surface" },
    h("p", { class: "tazuna-surface__placeholder" }, "Tazuna's help and explanations will live here."),
  );
}
