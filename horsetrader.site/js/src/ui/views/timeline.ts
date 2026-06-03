/**
 * The timeline substrate — the always-mounted, grabbable time-as-x world that is
 * the core representation *and* the primary navigation (ui.md principle 1). x is
 * true-to-date through the axis primitive (principle 2): a gap is a real gap.
 * This is the first real consumer of `axis.ts`, and where the step-3 standalone
 * scrub retires — the cursor is now a position on the axis, not a slider index.
 *
 * It owns the two pieces of **transient interaction-state** — the pan offset and
 * the cursor date — and writes them **straight to the DOM** (a CSS transform; the
 * cursor marker + the readout via `onScrub`). There is deliberately no broadcast
 * `subscribe` here, so a 60 Hz pan/scrub **structurally cannot** enter the render
 * path (docs/frontend/interaction.md, the two-tier change model). The render path
 * is the separate `layout()`, driven by the coordinator subscription.
 */

import { h } from "../h.ts";
import { createAxis } from "../axis.ts";
import type { Axis } from "../axis.ts";
import { addDays } from "../../core/projection/dates.ts";

/** The fixed zoom for now — px per day. Becomes discrete view-state when zoom lands. */
const PX_PER_DAY = 6;
/** Breathing room (days) padded either side of the data extent. */
const PAD_DAYS = 14;

/** Pan momentum, tuned for feel: per-ms velocity decay, the flick floor to start
 *  a glide at release, the floor at which the glide ends, and the pause-before-
 *  release window past which a lift is not a flick. */
const FRICTION_PER_MS = 0.9975;
const MIN_FLING_V = 0.05; // px/ms
const MIN_GLIDE_V = 0.015; // px/ms
const STALE_RELEASE_MS = 60;

type Extent = readonly [string, string] | null;

export interface Timeline {
  /** The always-mounted canvas viewport. */
  readonly el: HTMLElement;
  /**
   * (Re)lay the substrate for a balance-series extent and `today`: size the
   * content, reposition the static markers, clamp the cursor into range, and
   * re-emit the cursor date so the readout reflects the current projection.
   * Called on mount and after every recompute — the render path. Rare.
   */
  layout(extent: Extent, today: string): void;
  /**
   * The axis the last `layout` built (origin/scale), or `null` before the first
   * layout / on an empty extent. The **shared seam**: the shell reads it so the
   * card selectors position on the *same* true-date axis the substrate draws.
   */
  axis(): Axis | null;
  /**
   * Mount positioned card elements into the panning content layer, so they pan
   * with the world. The shell builds them from selectors + card views; the
   * timeline only hosts them (it stays dumb about what a card is).
   */
  setCards(elements: HTMLElement[]): void;
}

export interface TimelineHandlers {
  /**
   * Fired when the cursor lands on a date — the cheap path. The shell turns this
   * into `balanceAt` + a readout write; the timeline itself never broadcasts.
   */
  onScrub(date: string): void;
}

/** Clamp an ISO date into `[lo, hi]` — lexical compare is correct for `YYYY-MM-DD`. */
function clampDate(date: string, [lo, hi]: readonly [string, string]): string {
  return date < lo ? lo : date > hi ? hi : date;
}

export function timeline({ onScrub }: TimelineHandlers): Timeline {
  // Transient interaction-state, owned here and written directly — never broadcast.
  let panX = 0;
  let axis: Axis | null = null;
  let extent: Extent = null;
  let cursorDate: string | null = null;

  const line = h("div", { class: "timeline__line" });
  const today = h("div", { class: "timeline__today" });
  const cursor = h("div", { class: "timeline__cursor" });
  const cards = h("div", { class: "timeline__cards" }); // hosts the positioned card views
  const content = h("div", { class: "timeline__content" }, line, today, cursor, cards);
  const el = h("section", { class: "timeline", attr: { "aria-label": "Timeline" } }, content);

  const applyPan = () => {
    content.style.transform = `translateX(${panX}px)`;
  };
  const placeCursor = () => {
    if (axis && cursorDate !== null) cursor.style.left = `${axis.xForDate(cursorDate)}px`;
  };

  // --- pan: grab the world, with inertial momentum on release. Horizontal pan
  // is free and unbounded (ui.md EC1); the glide is the same transient state
  // written straight to the transform — still no broadcast. ---
  let dragging = false;
  let grabX = 0;
  let grabPan = 0;
  let velocity = 0; // px/ms, smoothed across a drag's moves
  let lastMoveX = 0;
  let lastMoveT = 0;
  let glide = 0; // requestAnimationFrame handle; 0 when idle

  const stopGlide = () => {
    if (glide) cancelAnimationFrame(glide);
    glide = 0;
  };
  const startGlide = () => {
    let last = performance.now();
    const step = (t: number) => {
      const dt = t - last;
      last = t;
      panX += velocity * dt;
      velocity *= Math.pow(FRICTION_PER_MS, dt);
      applyPan();
      glide = Math.abs(velocity) > MIN_GLIDE_V ? requestAnimationFrame(step) : 0;
    };
    glide = requestAnimationFrame(step);
  };

  el.addEventListener("pointerdown", (ev) => {
    stopGlide(); // grabbing the world halts any glide in progress
    dragging = true;
    grabX = ev.clientX;
    grabPan = panX;
    velocity = 0;
    lastMoveX = ev.clientX;
    lastMoveT = performance.now();
    el.setPointerCapture(ev.pointerId);
    el.classList.add("timeline--grabbing");
  });
  el.addEventListener("pointermove", (ev) => {
    if (dragging) {
      panX = grabPan + (ev.clientX - grabX); // transient → straight to the transform
      applyPan();
      const now = performance.now();
      const dt = now - lastMoveT;
      if (dt > 0) {
        velocity = velocity * 0.7 + ((ev.clientX - lastMoveX) / dt) * 0.3; // light smoothing
        lastMoveX = ev.clientX;
        lastMoveT = now;
      }
      return;
    }
    // --- scrub: a hover sets the cursor and pushes its date to the readout. ---
    if (!axis || !extent) return;
    const contentX = ev.clientX - el.getBoundingClientRect().left - panX;
    const date = clampDate(axis.dateForX(contentX), extent);
    if (date === cursorDate) return; // same day — nothing changed, skip the write
    cursorDate = date;
    placeCursor();
    onScrub(date);
  });
  const endDrag = (ev: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    el.releasePointerCapture(ev.pointerId);
    el.classList.remove("timeline--grabbing");
    // Fling only when the release follows live motion (not a pause-then-lift).
    if (performance.now() - lastMoveT < STALE_RELEASE_MS && Math.abs(velocity) > MIN_FLING_V) startGlide();
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);

  return {
    el,
    axis: () => axis,
    setCards: (elements) => cards.replaceChildren(...elements),
    layout(nextExtent, todayDate) {
      extent = nextExtent;
      if (!extent) {
        axis = null;
        cursorDate = null;
        content.style.width = "0px";
        today.style.display = "none";
        cursor.style.display = "none";
        return;
      }
      // Pad the origin so the first event isn't flush against the left edge.
      axis = createAxis({ origin: addDays(extent[0], -PAD_DAYS), pxPerDay: PX_PER_DAY });
      content.style.width = `${axis.xForDate(extent[1]) + PAD_DAYS * PX_PER_DAY}px`;

      today.style.display = "";
      today.style.left = `${axis.xForDate(todayDate)}px`;

      cursor.style.display = "";
      cursorDate = clampDate(cursorDate ?? todayDate, extent);
      placeCursor();
      onScrub(cursorDate); // refresh the readout against the (possibly new) projection
    },
  };
}
