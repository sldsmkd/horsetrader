import "./perfHud.css";

import { h } from "../h.ts";

const GRAPH_SAMPLES = 72;
const GRAPH_W = 144;
const GRAPH_H = 34;
const SAMPLE_MS = 250;

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
}

export function perfHud({ stats }: PerfHudOptions): PerfHud {
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
  const graph = h("canvas", { class: "perf-hud__graph", attr: { width: GRAPH_W, height: GRAPH_H } });
  const ctx = graph.getContext("2d");
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
    ctx.clearRect(0, 0, GRAPH_W, GRAPH_H);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1;
    for (let y = 0; y <= GRAPH_H; y += GRAPH_H / 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(GRAPH_W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(124, 240, 196, 0.92)";
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
