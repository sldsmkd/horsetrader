/**
 * The beta surface — Unity's in-app isolation chamber (design.md §9): where a WIP
 * feature proves out before graduating to the main UI.
 *
 * Its current tenant is **UmaMark** (grand-masters/umamark.md) — the deterministic
 * benchmark. The chamber itself is the feature flag: it's only reachable under `?umamark`
 * (which reveals the menubar 🔨), so this surface assumes that context and just hosts the
 * launcher. The plumbing (`RightSurface "beta"`, the `onBeta` seam, the `renderSurfaces`
 * branch) has always been here.
 */

import "./betaSurface.css";

import { h } from "../../h.ts";
import { surfaceActions } from "./surfaceActions.ts";

export interface BetaSurfaceOptions {
  onClose: () => void;
  /** Launch UmaMark: resets the camera, hides chrome and runs the benchmark. */
  onRunUmaMark: () => void;
}

export function betaSurface({ onClose, onRunUmaMark }: BetaSurfaceOptions): HTMLElement {
  return h(
    "section",
    { class: "beta-surface" },
    h("h3", { class: "beta-surface__group" }, "Beta chamber"),
    h(
      "p",
      { class: "beta-surface__note" },
      "UmaMark — the deterministic performance benchmark. It takes over the screen, drives a fixed camera workload over the timeline and reports a comparable score.",
    ),
    h(
      "button",
      { class: "beta-surface__run", attr: { type: "button" }, on: { click: onRunUmaMark } },
      "Run UmaMark",
    ),
    surfaceActions(h("button", { class: "beta-surface__cancel", attr: { type: "button" }, on: { click: onClose } }, "Cancel")),
  );
}
