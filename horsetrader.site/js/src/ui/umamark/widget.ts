/**
 * UmaMark's panel — the live readout during a run, and the results card after it.
 *
 * Dumb surface, like MangoHorse: it measures nothing. During a run the harness pushes it
 * the phase label + progress + the live fps it reads off the perf snapshot (NO capture
 * happens here — the score lives in the capture buffer); at the end it renders the per-test
 * aggregate the harness collected, including the headline of the whole exercise — the Test-2
 * frost cost delta against the opaque baseline.
 */

import { h } from "../h.ts";
import type { CaptureResult } from "../perf.ts";

/** The four measured passes a completed run produces. */
export interface UmaMarkResults {
  fillrate: CaptureResult;
  opaque: CaptureResult;
  alpha: CaptureResult;
  frost: CaptureResult;
}

export interface UmaMarkPanel {
  readonly el: HTMLElement;
  setPhase(label: string): void;
  setProgress(fraction: number, fps: number): void;
  showResults(results: UmaMarkResults, onClose: () => void): void;
}

const ms = (n: number): string => `${n.toFixed(1)}ms`;

export function umaMarkPanel(): UmaMarkPanel {
  const phase = h("span", { class: "umamark__phase" }, "Starting…");
  const fps = h("span", { class: "umamark__fps" }, "0 fps");
  const bar = h("div", { class: "umamark__bar-fill" });
  const pct = h("span", { class: "umamark__pct" }, "0%");
  const body = h(
    "div",
    { class: "umamark__live" },
    h("div", { class: "umamark__line" }, phase, fps),
    h("div", { class: "umamark__bar" }, bar),
    pct,
  );
  const el = h(
    "section",
    { class: "umamark__panel", attr: { "aria-label": "UmaMark benchmark" } },
    h("div", { class: "umamark__title" }, "UMAMARK"),
    body,
  );

  return {
    el,
    setPhase: (label) => {
      phase.textContent = label;
    },
    setProgress: (fraction, framerate) => {
      const clamped = Math.max(0, Math.min(1, fraction));
      bar.style.width = `${(clamped * 100).toFixed(1)}%`;
      pct.textContent = `${Math.round(clamped * 100)}%`;
      fps.textContent = `${Math.round(framerate)} fps`;
    },
    showResults: (results, onClose) => {
      body.replaceWith(resultsCard(results, onClose));
    },
  };
}

function resultsCard(results: UmaMarkResults, onClose: () => void): HTMLElement {
  const rows: Array<[string, CaptureResult]> = [
    ["Fillrate", results.fillrate],
    ["Opaque", results.opaque],
    ["Alpha", results.alpha],
    ["Frost", results.frost],
  ];
  const table = h(
    "table",
    { class: "umamark__table" },
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        ...["Test", "p50", "p95", "p99", "max", "fps", "over"].map((c) => h("th", {}, c)),
      ),
    ),
    h(
      "tbody",
      {},
      ...rows.map(([label, r]) =>
        h(
          "tr",
          {},
          h("td", {}, label),
          h("td", {}, ms(r.frameMs.p50)),
          h("td", {}, ms(r.frameMs.p95)),
          h("td", {}, ms(r.frameMs.p99)),
          h("td", {}, ms(r.frameMs.max)),
          h("td", {}, String(Math.round(r.fps))),
          h("td", {}, `${Math.round(r.overBudgetPct)}%`),
        ),
      ),
    ),
  );

  // The headline: frost's cost over the opaque baseline at p50 and p95 — the isolated
  // backdrop-filter price the parked blur verdict needs, measured not eyeballed.
  const frostP50 = results.frost.frameMs.p50 - results.opaque.frameMs.p50;
  const frostP95 = results.frost.frameMs.p95 - results.opaque.frameMs.p95;
  // When the run never overshot the refresh deadline, the GPU finished every frame with time
  // to spare — frost included — so frame-ms (which can't see sub-frame GPU work) reads ~0.
  // That's "free here", not "test broken": say so, and point at the constrained device where
  // the cost actually surfaces.
  const vsyncBound = results.opaque.overBudgetPct < 1 && results.frost.overBudgetPct < 1;
  const verdict = h(
    "div",
    { class: "umamark__verdict" },
    h("span", { class: "umamark__verdict-label" }, "Frost cost vs opaque"),
    h("span", { class: "umamark__verdict-value" }, `+${ms(frostP50)} p50 · +${ms(frostP95)} p95`),
    vsyncBound
      ? h(
          "span",
          { class: "umamark__verdict-note" },
          "vsync-bound — GPU headroom to spare; frost is free at this refresh. Run on the target device to surface its cost.",
        )
      : h("span", { class: "umamark__verdict-note" }, "frames dropped below refresh — the delta is real cost."),
  );

  // Opportunistic enrichment (Chrome/Android): the slow-frame autopsy + heap drift.
  const extras: HTMLElement[] = [];
  const fr = results.frost;
  if (fr.longFrames) {
    extras.push(
      h(
        "div",
        { class: "umamark__extra" },
        `LoAF (frost): ${fr.longFrames.count} slow · max ${ms(fr.longFrames.maxMs)} · block ${ms(fr.longFrames.totalBlockingMs)}`,
      ),
    );
  }
  if (fr.heapDeltaMb !== null) {
    extras.push(h("div", { class: "umamark__extra" }, `Heap Δ (frost): ${fr.heapDeltaMb.toFixed(2)} MB`));
  }
  extras.push(h("div", { class: "umamark__extra" }, `Budget ${ms(fr.budgetMs)} (device refresh)`));

  return h(
    "div",
    { class: "umamark__results" },
    verdict,
    table,
    ...extras,
    h(
      "button",
      { class: "umamark__close", attr: { type: "button" }, on: { click: onClose } },
      "Close",
    ),
  );
}
