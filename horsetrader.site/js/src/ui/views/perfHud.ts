import "./perfHud.css";

import { h } from "../h.ts";
import type { BakeStats } from "../../core/bundle/stats.gen.ts";

const GRAPH_SAMPLES = 72;
const GRAPH_W = 144;
const GRAPH_H = 34;
const SAMPLE_MS = 250;
// Per-frame churn history for the live percentile readout — ~28s @144Hz, ~68s
// @60Hz. The all-time high watermark (`max`) is tracked separately so it survives
// the ring wrapping.
const CHURN_WINDOW = 4096;
// F3 churn benchmark: warm up to shake lazy-load gremlins out (a full sweep mounts
// every card at least once), reset, then sweep the timeline end-to-end this many
// times capturing every frame's churn. One sweep = one full-extent warp; with no
// culling this should report ~0 — the baseline the cull/pool path must not regress.
const BENCH_WARMUP_SWEEPS = 2;
const BENCH_SWEEPS = 25;
// How long the benchmark result holds the CHURN row before live readout resumes.
const BENCH_HOLD_MS = 5000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function cssVar(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

function withAlpha(colour: string, alpha: number): string {
  const hex = colour.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    const value = Number.parseInt(full, 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }
  const rgb = colour.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return rgb ? `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})` : colour || "transparent";
}

export interface PerfHudStats {
  cards: number;
  aboveCards: number;
  belowCards: number;
  domNodes: number;
  // Trackblazer gating measurement: mounted cards split by viewport relation.
  visible: number;
  near: number;
  offscreen: number;
}

export interface PerfHud {
  readonly el: HTMLElement;
}

export interface PerfHudOptions {
  stats(): PerfHudStats;
  // Read+reset the DOM node churn since the last call. Drained once per frame to
  // bucket churn by frame for the high-watermark / percentile readout.
  drainChurn(): number;
  // Drive `sweeps` full end-to-end warps, resolving once they've all completed —
  // the F3 benchmark's motion. Provided by the shell, which owns warpTo + extent.
  warpScan(sweeps: number): Promise<void>;
  // Build-time vanity counters from stats.json — static, set once at construction.
  bake: BakeStats;
}

export function perfHud({ stats, drainChurn, warpScan, bake }: PerfHudOptions): PerfHud {
  let visible = false;
  let lastFrame = performance.now();
  let lastSample = lastFrame;
  let frames = 0;
  let fps = 0;
  const samples: number[] = [];

  // Per-frame churn ring + all-time high watermark, drained every frame (regardless
  // of HUD visibility) so each entry is one frame's worth. The F3 benchmark captures
  // its measured window into `benchFrames` off the same per-frame drain.
  const churn = new Float64Array(CHURN_WINDOW);
  let churnIdx = 0;
  let churnCount = 0;
  let churnMax = 0;
  let benching = false; // suppresses the live CHURN readout while a bench runs
  let capturing = false; // the measured window — push each frame into benchFrames
  let benchHoldUntil = 0; // hold the result on the row before live readout resumes
  const benchFrames: number[] = [];

  const fpsValue = h("span", { class: "perf-hud__value" }, "0");
  const frameValue = h("span", { class: "perf-hud__value" }, "0.0ms");
  const cardsValue = h("span", { class: "perf-hud__value" }, "0");
  const lanesValue = h("span", { class: "perf-hud__value" }, "0 / 0");
  const onscreenValue = h("span", { class: "perf-hud__value" }, "0 / 0 / 0");
  const offscreenValue = h("span", { class: "perf-hud__value" }, "0%");
  const churnValue = h("span", { class: "perf-hud__value" }, "0 / 0 / 0");
  const domValue = h("span", { class: "perf-hud__value" }, "0");
  const viewportValue = h("span", { class: "perf-hud__value" }, viewportResolution());
  const graph = h("canvas", { class: "perf-hud__graph", attr: { width: GRAPH_W, height: GRAPH_H } });
  const ctx = graph.getContext("2d");
  const buildMs = Math.round(bake.build_s * 1000).toLocaleString();
  // Predicted share of the timeline: predicted / (predicted + concrete). A proxy for
  // how far the bake is ahead of Global — events flip predicted → concrete as Global
  // announces real dates, so this falls as the game catches up.
  const knownEvents = bake.predicted + bake.confirmed;
  const predictedPct = knownEvents ? Math.round((bake.predicted / knownEvents) * 100) : 0;
  const el = h(
    "aside",
    { class: "perf-hud", attr: { "aria-label": "Performance HUD", "aria-hidden": "true" } },
    h("div", { class: "perf-hud__title" }, "MANGOHORSE"),
    graph,
    row("FPS", fpsValue),
    row("FRAME", frameValue),
    row("CARDS", cardsValue),
    row("LANES", lanesValue),
    // Gating measurement (visible / near-band / offscreen) and the headline ratio.
    row("ONSCREEN", onscreenValue),
    row("OFFSCREEN", offscreenValue),
    // Per-frame DOM churn: p99 / p99.9 / high-watermark. F3 resets for a clean pass.
    row("CHURN", churnValue),
    row("DOM", domValue),
    row("VIEW", viewportValue),
    // Eishin's production report: build-time facts, set once (not on the tick).
    // The header is in-character — the precise German baker signing off her run,
    // with the build time (ms, comma-grouped) as her stamp.
    h("div", { class: "perf-hud__divider" }, `Baked by Eishin ${buildMs}ms`),
    staticRow("SOURCES", String(bake.sources)),
    staticRow("EVENTS", String(bake.events)),
    staticRow("PREDICTED", `${predictedPct}%`),
    staticRow("ENTITIES", String(bake.entities)),
    staticRow("UNTRANSLATED", String(bake.no_en)),
    staticRow("BAKED", `${bake.baked_at.slice(5, 16).replace("T", " ")} UTC`),
  );

  const setVisible = (next: boolean) => {
    visible = next;
    el.classList.toggle("perf-hud--visible", visible);
    el.setAttribute("aria-hidden", String(!visible));
  };

  // The automated churn benchmark: warm up (mount everything), reset, then sweep the
  // timeline end-to-end BENCH_SWEEPS times capturing every frame's churn, and present.
  // The per-frame drain in `tick` keeps feeding the same ring; `capturing` forks each
  // frame's count into benchFrames so the report covers the full measured run (longer
  // than the live ring window).
  const runBench = async (): Promise<void> => {
    if (benching || !warpScan) return;
    benching = true;
    setVisible(true);
    churnValue.textContent = "warmup…";
    await warpScan(BENCH_WARMUP_SWEEPS);
    benchFrames.length = 0;
    capturing = true;
    churnValue.textContent = "running…";
    await warpScan(BENCH_SWEEPS);
    capturing = false;
    benching = false;
    presentBench();
  };

  const presentBench = (): void => {
    const sorted = [...benchFrames].sort((a, b) => a - b);
    const p99 = percentile(sorted, 99);
    const p999 = percentile(sorted, 99.9);
    const max = sorted.length ? sorted[sorted.length - 1] : 0;
    const total = benchFrames.reduce((sum, c) => sum + c, 0);
    const mean = benchFrames.length ? total / benchFrames.length : 0;
    churnValue.textContent = `${p99} / ${p999} / ${max}`;
    benchHoldUntil = performance.now() + BENCH_HOLD_MS;
    console.table({
      sweeps: BENCH_SWEEPS,
      frames: benchFrames.length,
      p99,
      "p99.9": p999,
      max,
      mean: Number(mean.toFixed(3)),
      "total nodes": total,
    });
  };

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "F2") {
      ev.preventDefault();
      setVisible(!visible);
    } else if (ev.key === "F3") {
      ev.preventDefault();
      void runBench();
    }
  });

  const draw = () => {
    if (!ctx) return;
    const gridColour = withAlpha(cssVar(el, "--ht-colour-text-on-accent"), 0.18);
    const graphColour = withAlpha(cssVar(el, "--ht-colour-diagnostic-accent"), 0.92);

    ctx.clearRect(0, 0, GRAPH_W, GRAPH_H);
    ctx.strokeStyle = gridColour;
    ctx.lineWidth = 1;
    for (let y = 0; y <= GRAPH_H; y += GRAPH_H / 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(GRAPH_W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = graphColour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    samples.forEach((sample, i) => {
      const x = (i / Math.max(1, GRAPH_SAMPLES - 1)) * GRAPH_W;
      const y = GRAPH_H - (Math.min(90, sample) / 90) * GRAPH_H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  const tick = (t: number) => {
    const frameMs = t - lastFrame;
    lastFrame = t;
    frames += 1;
    // Drain churn every frame (even when hidden) so each entry is one frame's worth.
    const frameChurn = drainChurn();
    churn[churnIdx] = frameChurn;
    churnIdx = (churnIdx + 1) % CHURN_WINDOW;
    if (churnCount < CHURN_WINDOW) churnCount += 1;
    if (frameChurn > churnMax) churnMax = frameChurn;
    if (capturing) benchFrames.push(frameChurn);
    if (t - lastSample >= SAMPLE_MS) {
      fps = (frames * 1000) / (t - lastSample);
      frames = 0;
      lastSample = t;
      samples.push(fps);
      if (samples.length > GRAPH_SAMPLES) samples.shift();

      if (visible) {
        const s = stats();
        fpsValue.textContent = String(Math.round(fps));
        frameValue.textContent = `${frameMs.toFixed(1)}ms`;
        cardsValue.textContent = String(s.cards);
        lanesValue.textContent = `${s.aboveCards} / ${s.belowCards}`;
        onscreenValue.textContent = `${s.visible} / ${s.near} / ${s.offscreen}`;
        const offscreenPct = s.cards ? Math.round((s.offscreen / s.cards) * 100) : 0;
        offscreenValue.textContent = `${offscreenPct}%`;
        // Live churn readout (p99 / p99.9 / max) over the ring — suppressed while a
        // bench runs or its result is still held on the row.
        if (!benching && t >= benchHoldUntil) {
          const sorted = Array.from(churn.subarray(0, churnCount)).sort((a, b) => a - b);
          churnValue.textContent = `${percentile(sorted, 99)} / ${percentile(sorted, 99.9)} / ${churnMax}`;
        }
        domValue.textContent = String(s.domNodes);
        viewportValue.textContent = viewportResolution();
        draw();
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return { el };
}

function row(label: string, value: HTMLElement): HTMLElement {
  return h("div", { class: "perf-hud__row" }, h("span", { class: "perf-hud__label" }, label), value);
}

function viewportResolution(): string {
  const dpr = window.devicePixelRatio || 1;
  return `${window.innerWidth}x${window.innerHeight} @${dpr.toFixed(2)}x`;
}

// A row whose value never changes after construction (the bake-stat block).
function staticRow(label: string, value: string): HTMLElement {
  return row(label, h("span", { class: "perf-hud__value" }, value));
}
