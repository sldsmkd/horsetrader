/**
 * UmaMark — the deterministic benchmark harness (grand-masters/umamark.md, Satano Group's
 * "3DMark" to MangoHorse's "Afterburner").
 *
 * MangoHorse passively observes the real session; UmaMark *drives* one. It scripts the
 * camera through a fixed, frame-stepped workload over the real (and so deterministic — the
 * bake is frozen JP history) timeline, reads Darley's perf instrument via `capture()`, and
 * produces a comparable score. Self-contained and in-page: no CDP, so it runs on the same
 * constrained phone where the blur verdict actually bites.
 *
 * The run:
 *   1. Warmup   — one round trip @ 20% screen-width/frame; primes async loads; unmeasured.
 *   2. Fillrate — 10 round trips @ 50%/frame; max cards crossing the cull boundary; measured.
 *   3. Transparency — a centre sampler (commit-surface size) over the moving world, one
 *      back-and-forth cycle @ 10%/frame, in three blend modes (opaque / alpha / frost), each
 *      captured separately. The opaque→frost delta is the isolated frost cost.
 *
 * All passes run at the timeline's fitted/overview zoom (`bench.reset()`), so every run
 * begins identically and the horizontal sweep has its room.
 */

import "./umamark.css";

import { h } from "../h.ts";
import { umaMarkPanel } from "./widget.ts";
import type { UmaMarkResults } from "./widget.ts";
import type { PerfInstrument, CaptureResult } from "../perf.ts";
import type { Timeline } from "../views/timeline/types.ts";

const WARMUP_STEP = 0.2; // screen-width fraction advanced per frame
const FILLRATE_STEP = 0.5;
const TRANS_STEP = 0.1;
const WARMUP_TRIPS = 1;
const FILLRATE_TRIPS = 10;
const TRANS_CYCLES = 1;

export interface UmaMarkOptions {
  timeline: Timeline;
  perf: PerfInstrument;
  /** Where the overlay (scrim + sampler + panel) mounts. */
  mount: HTMLElement;
  /** Chrome to hide for the run's duration (menubar, surfaces, bookmarks, minimap, HUD) —
   *  restored on completion. The world (timeline + wallpaper) stays. */
  chrome: readonly HTMLElement[];
}

export interface UmaMark {
  /** Reset the camera to the canonical start, hide chrome, run all passes, then show the
   *  results card. A no-op while a run is already in flight. */
  run(): Promise<void>;
}

/** One leg of a sweep: pan linearly from `from` to `to` over `frames` animation frames. */
interface Leg {
  from: number;
  to: number;
  frames: number;
}

function roundTrips(panMin: number, viewportW: number, stepFrac: number, trips: number): Leg[] {
  const stepPx = Math.max(1, viewportW * stepFrac);
  const framesPerLeg = Math.max(1, Math.ceil(Math.abs(panMin) / stepPx));
  const legs: Leg[] = [];
  for (let t = 0; t < trips; t += 1) {
    legs.push({ from: 0, to: panMin, frames: framesPerLeg }); // start edge → end edge
    legs.push({ from: panMin, to: 0, frames: framesPerLeg }); // and back
  }
  return legs;
}

const legFrames = (legs: Leg[]): number => legs.reduce((sum, leg) => sum + leg.frames, 0);

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export function createUmaMark({ timeline, perf, mount, chrome }: UmaMarkOptions): UmaMark {
  const panel = umaMarkPanel();
  const sampler = h("div", { class: "umamark__sampler", attr: { "aria-hidden": "true" } });
  const overlay = h("div", { class: "umamark", attr: { "aria-hidden": "true" } }, sampler, panel.el);

  let running = false;

  const setChromeHidden = (hidden: boolean): void => {
    for (const node of chrome) node.classList.toggle("umamark-hidden", hidden);
  };

  const setSamplerMode = (mode: "opaque" | "alpha" | "frost" | null): void => {
    sampler.className = "umamark__sampler";
    if (mode) sampler.classList.add("umamark__sampler--visible", `umamark__sampler--${mode}`);
  };

  // Drive one set of legs frame-by-frame off rAF. `measured` wraps the legs in a perf
  // capture; the harness measures nothing itself — it just moves the camera and lets the
  // instrument time the resulting frames.
  function sweep(legs: Leg[], onFrame: () => void, measured: boolean): Promise<CaptureResult | null> {
    return new Promise((resolve) => {
      const capture = measured ? perf.capture() : null;
      let li = 0;
      let fi = 0;
      const tick = (): void => {
        if (li >= legs.length) {
          resolve(capture ? capture.stop() : null);
          return;
        }
        const leg = legs[li];
        const p = leg.frames <= 1 ? 1 : fi / (leg.frames - 1);
        timeline.bench.setPanX(leg.from + (leg.to - leg.from) * p);
        onFrame();
        fi += 1;
        if (fi >= leg.frames) {
          li += 1;
          fi = 0;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  async function run(): Promise<void> {
    if (running) return;
    running = true;

    mount.appendChild(overlay);
    overlay.classList.add("umamark--running"); // scrim absorbs input so a stray touch can't fight the scripted camera
    setChromeHidden(true);

    // Canonical start: scene-start edge, fitted zoom — every run begins identically.
    timeline.bench.reset();
    await nextFrame(); // let the reset paint + the world settle before we start timing

    const viewportW = timeline.bench.viewportWidth();
    const panMin = timeline.bench.panMin();

    const warmupLegs = roundTrips(panMin, viewportW, WARMUP_STEP, WARMUP_TRIPS);
    const fillrateLegs = roundTrips(panMin, viewportW, FILLRATE_STEP, FILLRATE_TRIPS);
    const transLegs = roundTrips(panMin, viewportW, TRANS_STEP, TRANS_CYCLES);

    const totalFrames = legFrames(warmupLegs) + legFrames(fillrateLegs) + 3 * legFrames(transLegs);
    let done = 0;
    const onFrame = (): void => {
      done += 1;
      panel.setProgress(done / totalFrames, perf.snapshot().fps);
    };

    panel.setPhase("Warmup");
    await sweep(warmupLegs, onFrame, false);

    panel.setPhase("Fillrate");
    const fillrate = await sweep(fillrateLegs, onFrame, true);

    const modes = [
      ["opaque", "Transparency · Opaque"],
      ["alpha", "Transparency · Simple alpha"],
      ["frost", "Transparency · Frost"],
    ] as const;
    const trans: Partial<Record<"opaque" | "alpha" | "frost", CaptureResult>> = {};
    for (const [mode, label] of modes) {
      setSamplerMode(mode);
      panel.setPhase(label);
      const result = await sweep(transLegs, onFrame, true); // measured sweep always returns a result
      if (result) trans[mode] = result;
    }
    setSamplerMode(null);

    // Hand the screen back: restore chrome, drop the scrim, show the results card.
    setChromeHidden(false);
    overlay.classList.remove("umamark--running");

    const results: UmaMarkResults = {
      fillrate: fillrate!,
      opaque: trans.opaque!,
      alpha: trans.alpha!,
      frost: trans.frost!,
    };
    logResults(results);
    panel.showResults(results, () => {
      overlay.remove();
    });
    running = false;
  }

  return { run };
}

// Desktop convenience: copy-pasteable into a doc to diff a code change. Phones have no
// console — that's what the on-screen results card is for.
function logResults(results: UmaMarkResults): void {
  const row = (r: CaptureResult): Record<string, number> => ({
    p50: +r.frameMs.p50.toFixed(2),
    p95: +r.frameMs.p95.toFixed(2),
    p99: +r.frameMs.p99.toFixed(2),
    max: +r.frameMs.max.toFixed(2),
    fps: Math.round(r.fps),
    "over%": Math.round(r.overBudgetPct),
  });
  console.table({
    Fillrate: row(results.fillrate),
    Opaque: row(results.opaque),
    Alpha: row(results.alpha),
    Frost: row(results.frost),
  });
}
