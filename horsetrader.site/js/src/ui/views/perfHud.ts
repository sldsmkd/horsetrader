import "./perfHud.css";

import { h } from "../h.ts";
import type { BakeStats } from "../../core/bundle/stats.gen.ts";
import type { PerfInstrument, PerfSnapshot } from "../perf.ts";

const GRAPH_SAMPLES = 72;
const GRAPH_W = 144;
const GRAPH_H = 34;

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

/** Point-in-time scene counts — supplied by the app each render; not measured here. */
export interface PerfHudStats {
  cards: number;
  aboveCards: number;
  belowCards: number;
  timelineGolshis: number;
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
  /** Darley's perf instrument — the HUD subscribes to its snapshots while visible. */
  perf: PerfInstrument;
  /** Scene counts read at render time (the timeline/culling already own this collection). */
  stats(): PerfHudStats;
  /** Build-time vanity counters from stats.json — static, set once at construction. */
  bake: BakeStats;
}

/**
 * MangoHorse — the performance HUD. A dumb surface (the debut-era joke that grew up): it
 * MEASURES nothing. The frame loop, churn collection and frame budget live in the perf
 * instrument (ui/perf.ts, Darley's); this view subscribes while visible and renders the
 * snapshot alongside the app's scene counts and the build-time bake report.
 */
export function perfHud({ perf, stats, bake }: PerfHudOptions): PerfHud {
  let visible = false;
  let unsubscribe: (() => void) | null = null;

  const fpsValue = h("span", { class: "perf-hud__value" }, "0");
  const frameValue = h("span", { class: "perf-hud__value" }, "0.0ms");
  const cardsValue = h("span", { class: "perf-hud__value" }, "0");
  const lanesValue = h("span", { class: "perf-hud__value" }, "0 / 0");
  const onscreenValue = h("span", { class: "perf-hud__value" }, "0 / 0 / 0");
  const offscreenValue = h("span", { class: "perf-hud__value" }, "0%");
  const churnValue = h("span", { class: "perf-hud__value" }, "0 / 0 / 0");
  const domValue = h("span", { class: "perf-hud__value" }, "0");
  const lengthValue = h("span", { class: "perf-hud__value" }, "0g");
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
    // Per-frame DOM churn: p99 / p99.9 / high-watermark over the live ring.
    row("CHURN", churnValue),
    row("DOM", domValue),
    row("LENGTH", lengthValue),
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

  const draw = (samples: readonly number[]): void => {
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

  const render = (snap: PerfSnapshot): void => {
    const s = stats();
    fpsValue.textContent = String(Math.round(snap.fps));
    // Adherence made visible: flag the readout when the instrument says we're missing budget.
    fpsValue.classList.toggle("perf-hud__value--over", snap.overBudget);
    frameValue.textContent = `${snap.frameMs.toFixed(1)}ms`;
    cardsValue.textContent = String(s.cards);
    lanesValue.textContent = `${s.aboveCards} / ${s.belowCards}`;
    onscreenValue.textContent = `${s.visible} / ${s.near} / ${s.offscreen}`;
    const offscreenPct = s.cards ? Math.round((s.offscreen / s.cards) * 100) : 0;
    offscreenValue.textContent = `${offscreenPct}%`;
    churnValue.textContent = `${snap.churnP99} / ${snap.churnP999} / ${snap.churnMax}`;
    domValue.textContent = String(s.domNodes);
    lengthValue.textContent = `${Math.round(s.timelineGolshis).toLocaleString()}g`;
    viewportValue.textContent = viewportResolution();
    draw(snap.fpsSamples);
  };

  const setVisible = (next: boolean): void => {
    visible = next;
    el.classList.toggle("perf-hud--visible", visible);
    el.setAttribute("aria-hidden", String(!visible));
    // Only subscribe (and so only build snapshots) while shown — the instrument's loop
    // keeps measuring regardless, but the HUD pays nothing when hidden.
    if (visible) {
      render(perf.snapshot()); // immediate paint, don't wait for the next sample
      unsubscribe = perf.subscribe(render);
    } else {
      unsubscribe?.();
      unsubscribe = null;
    }
  };

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "F2") {
      ev.preventDefault();
      setVisible(!visible);
    }
  });

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
