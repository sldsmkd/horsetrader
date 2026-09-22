/**
 * The beta surface — Unity's in-app isolation chamber (design.md §9): where a WIP
 * feature proves out before graduating to the main UI.
 *
 * Its current tenant is **UmaMark** (grand-masters/umamark.md) — the deterministic
 * benchmark. The chamber is reachable only by the **supporter cohort**: the menubar 🔨
 * is revealed by `setBetaAvailable`, driven off the supporter entitlement the app watches
 * on every cloud pull (supporters-as-beta-flag), so this surface assumes that context and
 * just hosts the launcher. The plumbing (`RightSurface "beta"`, the `onBeta` seam, the
 * `renderSurfaces` branch) has always been here.
 *
 * It also carries the **Special Week onboarding dev knob** (special-week/spec.md): the
 * `firstrun` watermark is sticky-by-design (each tour shows once, ever), so the only place
 * to replay it is here, behind the supporter gate — never a real-user surface.
 */

import "./betaSurface.css";

import { h } from "../../h.ts";
import { surfaceActions } from "./surfaceActions.ts";
import { surfaceCancel } from "./surface.ts";
import { ONBOARDING_STAGE_COUNT } from "../onboarding/onboarding.ts";
import type { Bundle } from "../../bundle/access.ts";
import type { CalendarDate } from "../../../core/projection/dates.ts";
import { downloadPredictedSchedule, predictedSchedule } from "./predictedSchedule.ts";

export interface BetaSurfaceOptions {
  onClose: () => void;
  /** Launch UmaMark: resets the camera, hides chrome and runs the benchmark. */
  onRunUmaMark: () => void;
  /** The current onboarding watermark (shown live in the dev knob). */
  firstrun: number;
  /** Set the watermark and re-arm the tour from there (the app re-runs it inline). */
  onSetFirstrun: (stage: number) => void;
  /** Current bake plus UTC today: the preview renders only from these local facts. */
  bundle: Bundle;
  today: CalendarDate;
}

export function betaSurface({ onClose, onRunUmaMark, firstrun, onSetFirstrun, bundle, today }: BetaSurfaceOptions): HTMLElement {
  // One jump per stage: stage k becomes the next shown by setting the watermark to k-1.
  const jumps = Array.from({ length: ONBOARDING_STAGE_COUNT }, (_, k) =>
    h(
      "button",
      { class: "beta-surface__chip", attr: { type: "button" }, on: { click: () => onSetFirstrun(k) } },
      `Stage ${k + 1}`,
    ),
  );
  const schedule = predictedSchedule(bundle, today);
  const poster = h(
    "button",
    {
      class: "beta-surface__run",
      attr: { type: "button" },
      on: {
        click: () => {
          poster.disabled = true;
          poster.textContent = "Generating PNG…";
          void downloadPredictedSchedule(bundle, today).then(
            () => { poster.textContent = "Download predicted-schedule PNG"; poster.disabled = false; },
            () => { poster.textContent = "Could not generate PNG — retry"; poster.disabled = false; },
          );
        },
      },
    },
    "Download predicted-schedule PNG",
  );

  return h(
    "section",
    { class: "beta-surface" },
    h("h3", { class: "beta-surface__group" }, "Beta chamber"),
    h("h3", { class: "beta-surface__group" }, `${schedule.month} ${schedule.year} forecast`),
    h("p", { class: "beta-surface__note" }, `${schedule.events.length} predicted releases. Generates a local, unofficial PNG poster.`),
    poster,
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
    h("h3", { class: "beta-surface__group" }, "Onboarding"),
    h("p", { class: "beta-surface__note" }, `Tazuna's first-run tour. Watermark: firstrun = ${firstrun}.`),
    h(
      "div",
      { class: "beta-surface__chips" },
      h(
        "button",
        { class: "beta-surface__chip", attr: { type: "button" }, on: { click: () => onSetFirstrun(0) } },
        "Replay all",
      ),
      ...jumps,
    ),
    surfaceActions(surfaceCancel({ class: "beta-surface__cancel", onCancel: onClose })),
  );
}
