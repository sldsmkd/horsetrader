import "./surfaceActions.css";

import { h } from "../../h.ts";

/**
 * The shared footer for a surface's actions: a centred, gapped, bottom-anchored
 * row. `margin-top: auto` pins it to the floor of a flex-column surface (e.g. the
 * play-style card) and is a harmless no-op in a content-sized modal. The buttons
 * keep their own appearance — only the container layout is shared. This is Debut's
 * surface-action grammar: a centred pair, never the corner-pinned dialog split.
 */
export function surfaceActions(...buttons: Node[]): HTMLElement {
  return h("footer", { class: "surface-actions" }, ...buttons);
}
