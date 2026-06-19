/**
 * The beta surface — Unity's in-app isolation chamber (design.md §9): where a WIP
 * feature proves out before graduating to the main UI.
 *
 * PARKED. Its first tenant, the Unity cloud save/load controls (Cloud + Sync), has
 * graduated onto the trainer card ([cloudControls.ts](cloudControls.ts)), so the chamber
 * is currently empty. The plumbing is kept intact — the `RightSurface "beta"` member, the
 * `onBeta` seam, the `renderOverlay` branch that mounts this — but the menubar renders no
 * entry, so it's inactive + hidden. The next big feature graduates through here: drop its
 * surface in below and re-add the menubar icon (see menubar.ts).
 */

import "./betaSurface.css";

import { h } from "../h.ts";
import { surfaceActions } from "./surfaceActions.ts";

export function betaSurface(onClose: () => void): HTMLElement {
  return h(
    "section",
    { class: "beta-surface" },
    h("h3", { class: "beta-surface__group" }, "Beta chamber"),
    h(
      "p",
      { class: "beta-surface__note" },
      "Nothing in here right now — the next work-in-progress feature will surface here before it graduates to the main UI.",
    ),
    surfaceActions(h("button", { class: "beta-surface__cancel", attr: { type: "button" }, on: { click: onClose } }, "Cancel")),
  );
}
