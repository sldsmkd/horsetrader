import "./perfHud.css";

import { h } from "../h.ts";
import type { BakeStats } from "../../core/bundle/stats.gen.ts";

const GRAPH_SAMPLES = 72;
const GRAPH_W = 144;
const GRAPH_H = 34;
const SAMPLE_MS = 250;

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
}

export interface PerfHud {
  readonly el: HTMLElement;
}

export interface PerfHudOptions {
  stats(): PerfHudStats;
  // Build-time vanity counters from stats.json — static, set once at construction.
  bake: BakeStats;
}

export function perfHud({ stats, bake }: PerfHudOptions): PerfHud {
  let visible = false;
  let lastFrame = performance.now();
  let lastSample = lastFrame;
  let frames = 0;
  let fps = 0;
  const samples: number[] = [];

  const fpsValue = h("span", { class: "perf-hud__value" }, "0");
  const frameValue = h("span", { class: "perf-hud__value" }, "0.0ms");
  const cardsValue = h("span", { class: "perf-hud__value" }, "0");
  const lanesValue = h("span", { class: "perf-hud__value" }, "0 / 0");
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

  window.addEventListener("keydown", (ev) => {
    if (ev.key !== "F2") return;
    ev.preventDefault();
    setVisible(!visible);
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
