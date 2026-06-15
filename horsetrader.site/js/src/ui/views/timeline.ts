/**
 * The timeline substrate — the always-mounted, grabbable time-as-x world that is
 * the core representation *and* the primary navigation (ui.md principle 1). x is
 * true-to-date through the axis primitive (principle 2): a gap is a real gap.
 * This is the first real consumer of `axis.ts`, and where the step-3 standalone
 * scrub retires. As of 4f the focus is the view centre itself — there is no
 * separate cursor; panning *is* re-focusing.
 *
 * It owns the **transient interaction-state** — the pan offset — and writes it
 * **straight to the DOM** (a CSS transform), emitting the view-centre date via
 * `onView` for the menubar + minimap window. There is deliberately no broadcast
 * `subscribe` here, so a 60 Hz pan **structurally cannot** enter the render path
 * (docs/frontend/interaction.md, the two-tier change model). The render path is
 * the separate `layout()`, driven by the coordinator subscription.
 */

import "./timeline.css";

import { h } from "../h.ts";
import { createAxis } from "../axis.ts";
import type { Axis } from "../axis.ts";
import { addDays } from "../../core/projection/dates.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";

/** Px per day — the fixed true-to-date scale (ui.md principle 2). We don't zoom
 *  beyond browser ctrl-+/-, so this is a constant, not view-state. Matches the
 *  prototype's spacing so a date-gap reads as room, not a crush. */
const PX_PER_DAY = 100;
/** Breathing room (days) padded either side of the data extent — the prototype's
 *  fixed buffer before the first card and after the last. */
const PAD_DAYS = 3;

/** Pan momentum, tuned for feel: per-ms velocity decay, the flick floor to start
 *  a glide at release, the floor at which the glide ends, and the pause-before-
 *  release window past which a lift is not a flick. */
const FRICTION_PER_MS = 0.9975;
const MIN_FLING_V = 0.05; // px/ms
const MIN_GLIDE_V = 0.015; // px/ms
const STALE_RELEASE_MS = 60;

/** Elastic walls: the rubber-band tension when dragging past an end (lower =
 *  stiffer), the per-frame ease fraction the spring-back uses to recentre on the
 *  wall, and the px within which the spring snaps home. */
const RUBBER_TENSION = 0.55;
const SPRING_EASE = 0.18;
const SPRING_SNAP_PX = 0.5;

/** Axis-intent lock: a drag commits to horizontal after this much travel. The
 *  railtrack constants below decide when a vertical gesture deliberately derails. */
const AXIS_COMMIT_PX = 8;
/** The centre line is a railtrack, not a spring: it takes a deliberate vertical
 *  shove to derail, and once derailed the lane offset persists. Passing back
 *  through the capture band snaps onto the rail again. */
const TRACK_DERAIL_PX = 42;
const TRACK_CAPTURE_PX = 2;
const TRACK_RAIL_VISUAL_PX = 32;
const TRACK_DERAIL_BIAS = 1.15;
const TRACK_MIN_TRAVEL_VIEWPORT = 0.35;
const TRACK_RETURN_SPEED_PX_PER_MS = 2.4;
const TRACK_RETURN_MAX_EASE = 0.11;
const TRACK_GRIP_FALLOFF_PX = 320;
const TRACK_GRIP_MIN = 0.32;

/** Deliberate navigation ("warp") timing. Short hops should feel crisp; long
 *  jumps should visibly travel without making the user wait through the whole
 *  distance. The exponential distance curve approaches the max instead of
 *  growing without bound. */
const WARP_MIN_MS = 650;
const WARP_MAX_MS = 1500;
const WARP_DISTANCE_SCALE_PX = 4000;

type Extent = readonly [CalendarDate, CalendarDate] | null;

export interface Timeline {
  /** The always-mounted canvas viewport. */
  readonly el: HTMLElement;
  /**
   * (Re)lay the substrate for a balance-series extent and `today`: size the
   * content, reposition the static markers, clamp the cursor into range, and
   * re-emit the cursor date so chrome reflects the current projection.
   * Called on mount and after every recompute — the render path. Rare.
   */
  layout(extent: Extent, today: CalendarDate): void;
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
  /**
   * Report how far the packed cards reach above and below the centre line (px),
   * measured after a pack. Sets the dynamic vertical roof/floor — only the depth
   * past the viewport half becomes a peekable region.
   */
  setContentDepth(above: number, below: number): void;
  /**
   * Pan so `date` sits at the viewport centre, clamped to the walls — the minimap
   * seek's target. Halts any glide so the navigation is authoritative; emits the
   * new view date through `onView` (via the pan), closing the two-way binding.
   */
  centerOn(date: CalendarDate): void;
  /**
   * Smoothly travel so `date` sits at the viewport centre. This is the shared
   * deliberate-navigation primitive for Home, bookmarks, and search: accelerated,
   * bounded by distance, and still cheap-path only.
   */
  warpTo(date: CalendarDate): void;
}

export interface TimelineHandlers {
  /**
   * Fired when the *view centre* moves (any pan: drag, glide, layout, seek) — the
   * date at the middle of the viewport, which is the focus, plus the vertical
   * well offset in `[-1, 1]` for the minimap window. The shell turns the date into
   * a `balanceAt` + menubar write and routes both values to the minimap window.
   * Cheap path, deduped by date + vertical offset; never broadcasts.
   */
  onView(date: CalendarDate, verticalOffset: number): void;
}

/** Clamp a calendar date into `[lo, hi]` — lexical compare is correct for `YYYY-MM-DD`. */
function clampDate(date: CalendarDate, [lo, hi]: readonly [CalendarDate, CalendarDate]): CalendarDate {
  return date < lo ? lo : date > hi ? hi : date;
}

function easeInOutSmootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function warpDuration(distancePx: number): number {
  const scaled = 1 - Math.exp(-Math.abs(distancePx) / WARP_DISTANCE_SCALE_PX);
  return WARP_MIN_MS + (WARP_MAX_MS - WARP_MIN_MS) * scaled;
}

export function timeline({ onView }: TimelineHandlers): Timeline {
  // Transient interaction-state, owned here and written directly — never broadcast.
  let panX = 0;
  let panY = 0; // vertical peek offset; rests at 0 (the line recentred)
  let axis: Axis | null = null;
  let extent: Extent = null;
  let viewDate: CalendarDate | null = null; // last emitted view-centre date, for dedupe
  let viewOffset = Number.NaN; // last emitted vertical well offset, for dedupe
  let centerX = 0; // exact content-space x at the viewport middle — preserved across resizes
  let centered = false; // first layout centres the view on today; later ones keep the pan
  // How far cards reach above / below the centre line (px), set after each pack.
  // The dynamic roof and floor: only the overflow past the viewport half is pannable.
  let aboveDepth = 0;
  let belowDepth = 0;

  const line = h("div", { class: "timeline__line" });
  const today = h("div", { class: "timeline__today" });
  const cards = h("div", { class: "timeline__cards" }); // hosts the positioned card views
  const content = h("div", { class: "timeline__content" }, line, today, cards);
  const rail = h("div", { class: "timeline__rail", attr: { "aria-hidden": "true" } });
  const el = h("section", { class: "timeline", attr: { "aria-label": "Timeline" } }, rail, content);
  el.style.setProperty("--timeline-rail-height", `${TRACK_RAIL_VISUAL_PX}px`);

  const applyPan = () => {
    content.style.transform = `translate(${panX}px, ${panY}px)`;
    // Track the exact content-space x under the viewport middle, so a resize can
    // re-centre on it (grow out from the centre, not pad the right edge).
    centerX = el.clientWidth / 2 - panX;
    // The view centre *is* the focus: its date drives the menubar and the minimap
    // window (cheap path, deduped). There is no separate cursor — the anchor is
    // always the middle of the view. Guarded by the axis; clamped into the extent.
    if (axis && extent) {
      const date = clampDate(axis.dateForX(centerX), extent);
      const offset = verticalOffset();
      if (date !== viewDate || offset !== viewOffset) {
        viewDate = date;
        viewOffset = offset;
        onView(date, offset);
      }
    }
  };

  // --- pan: grab the world, bounded by elastic walls. `panX` is the *applied*
  // offset; dragging past an end meets rubber-band resistance, and release/glide
  // springs back to recentre on the wall (the content's start or end edge). Still
  // transient state written straight to the transform — no broadcast. ---
  let dragging = false;
  let grabX = 0;
  let grabY = 0;
  let grabPanY = 0;
  let velocity = 0; // px/ms, smoothed across a drag's moves (horizontal only)
  let axisLock: "none" | "horizontal" | "free" = "none"; // gesture intent, per drag
  let lastMoveX = 0;
  let lastMoveT = 0;
  let anim = 0; // requestAnimationFrame handle; 0 when idle

  // The horizontal pan range that keeps content on screen: 0 holds the start edge
  // at the viewport's left; the (negative) min holds the end edge at its right.
  // Content narrower than the viewport has no travel — both clamp to 0.
  const panBounds = () => {
    const min = Math.min(0, el.clientWidth - content.offsetWidth);
    return { min, max: 0 };
  };
  // The vertical well. Lane overflow can extend it, but it always has a minimum
  // viewport-sized run so the track can derail even when cards currently fit.
  // Rest is wherever the user left the lane, unless the rail recaptures.
  const panBoundsY = () => {
    const half = el.clientHeight / 2;
    const minTravel = Math.max(TRACK_DERAIL_PX + TRACK_RAIL_VISUAL_PX / 2, el.clientHeight * TRACK_MIN_TRAVEL_VIEWPORT);
    return { min: -Math.max(minTravel, belowDepth - half), max: Math.max(minTravel, aboveDepth - half) };
  };
  const verticalOffset = () => {
    const { min, max } = panBoundsY();
    const range = panY >= 0 ? max : -min;
    return range > 0 ? Math.max(-1, Math.min(1, panY / range)) : 0;
  };
  // Diminishing-returns overscroll: the further past a wall, the less it gives —
  // an asymptote at `dim`, so the wall stiffens but never locks.
  const rubber = (over: number, dim: number) => (1 - 1 / ((over / (dim || 1)) * RUBBER_TENSION + 1)) * dim;
  // Map an intended pan to its applied value, rubber-damped beyond the walls.
  const dampWith = (raw: number, min: number, max: number, dim: number) => {
    if (raw > max) return max + rubber(raw - max, dim);
    if (raw < min) return min - rubber(min - raw, dim);
    return raw;
  };
  const damp = (raw: number) => {
    const { min, max } = panBounds();
    return dampWith(raw, min, max, el.clientWidth);
  };
  const clampY = (raw: number) => {
    const { min, max } = panBoundsY();
    return Math.max(min, Math.min(max, raw));
  };
  const trackReturn = (raw: number, speedX: number, dt: number) => {
    if (Math.abs(raw) <= TRACK_CAPTURE_PX) return 0;
    const speed = Math.min(1, Math.abs(speedX) / TRACK_RETURN_SPEED_PX_PER_MS);
    const ease = TRACK_RETURN_MAX_EASE * speed * Math.min(1, dt / 16);
    const next = raw * (1 - ease);
    return Math.abs(next) <= TRACK_CAPTURE_PX ? 0 : clampY(next);
  };
  const trackGrip = (y: number) => {
    const offRail = Math.max(0, Math.abs(y) - TRACK_CAPTURE_PX);
    const falloff = offRail / TRACK_GRIP_FALLOFF_PX;
    return TRACK_GRIP_MIN + (1 - TRACK_GRIP_MIN) / (1 + falloff * falloff);
  };

  const stopAnim = () => {
    if (anim) cancelAnimationFrame(anim);
    anim = 0;
  };
  const targetPanForDate = (date: CalendarDate) => {
    if (!axis) return null;
    const { min, max } = panBounds();
    return Math.max(min, Math.min(max, el.clientWidth / 2 - axis.xForDate(date)));
  };
  // Horizontal animation: past a wall it eases home (killing momentum), within
  // bounds it coasts on friction until it stalls or hits a wall. If the timeline
  // is floating off-rail, horizontal speed also pulls Y back toward the track.
  const startAnim = () => {
    stopAnim();
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(t - last, 64); // clamp so a backgrounded tab doesn't lurch
      last = t;
      const ease = 1 - Math.pow(1 - SPRING_EASE, dt / 16); // frame-rate-correct

      // Horizontal.
      const { min, max } = panBounds();
      let xActive: boolean;
      if (panX > max || panX < min) {
        const wall = panX > max ? max : min;
        panX += (wall - panX) * ease;
        velocity = 0;
        xActive = Math.abs(panX - wall) >= SPRING_SNAP_PX;
        if (!xActive) panX = wall;
      } else {
        panX += velocity * dt * trackGrip(panY);
        panY = trackReturn(panY, velocity, dt);
        velocity *= Math.pow(FRICTION_PER_MS, dt);
        xActive = Math.abs(velocity) > MIN_GLIDE_V || panX < min || panX > max;
      }

      applyPan();
      anim = xActive ? requestAnimationFrame(step) : 0;
    };
    anim = requestAnimationFrame(step);
  };

  el.addEventListener("pointerdown", (ev) => {
    stopAnim(); // grabbing the world halts any glide/spring in progress
    // Resync the readout on every grab: clear the `onView` dedupe sentinel so the
    // first `applyPan` of this gesture re-emits the centre date even if it rounds
    // to the same day. Belt-and-braces against a rare drift where `viewDate` falls
    // out of step with what the menubar/minimap actually show (repro unknown —
    // observed once as a stuck carats readout that a minimap click + re-pan fixed,
    // which is exactly this forced re-emit). Cost is one extra emit per gesture,
    // not per pixel, so it doesn't undo the per-day dedupe.
    viewDate = null;
    dragging = true;
    axisLock = Math.abs(panY) > TRACK_CAPTURE_PX ? "free" : "none";
    grabX = ev.clientX;
    grabY = ev.clientY;
    grabPanY = panY;
    velocity = 0;
    lastMoveX = ev.clientX;
    lastMoveT = performance.now();
    el.setPointerCapture(ev.pointerId);
    el.classList.add("timeline--grabbing");
  });
  el.addEventListener("pointermove", (ev) => {
    if (dragging) {
      const dx = ev.clientX - grabX;
      const dy = ev.clientY - grabY;
      const now = performance.now();
      const dt = now - lastMoveT;
      const frameDx = ev.clientX - lastMoveX;
      const sampleVelocity = dt > 0 ? frameDx / dt : 0;
      // Commit the gesture once it's travelled enough to read intent. When the
      // gesture starts on the rail, this commits to horizontal; vertical has to
      // clear the rail's derail threshold below.
      if (axisLock === "none" && Math.hypot(dx, dy) > AXIS_COMMIT_PX) {
        axisLock = "horizontal";
      }
      // The centre line is a deep rail: when starting on it, a vertical gesture
      // must spend some travel climbing out before the Y offset starts moving.
      if (axisLock !== "free" && Math.abs(dy) > TRACK_DERAIL_PX && Math.abs(dy) > Math.abs(dx) * TRACK_DERAIL_BIAS) {
        axisLock = "free";
        grabY = ev.clientY - Math.sign(dy) * (TRACK_CAPTURE_PX + 1);
        grabPanY = 0;
      }
      if (axisLock === "free") {
        const rawY = grabPanY + (ev.clientY - grabY);
        // Panning back over the rail recaptures it: snap to the line and make the
        // user deliberately bump out again before vertical movement resumes.
        if (Math.abs(rawY) <= TRACK_CAPTURE_PX) {
          panY = 0;
          grabY = ev.clientY;
          grabPanY = 0;
          axisLock = "horizontal";
        } else {
          panY = trackReturn(clampY(rawY), sampleVelocity, dt);
          grabY = ev.clientY;
          grabPanY = panY;
          if (panY === 0) axisLock = "horizontal";
        }
      }
      panX = damp(panX + frameDx * trackGrip(panY)); // horizontal always pans (the primary gesture)
      applyPan();
      if (dt > 0) {
        velocity = velocity * 0.7 + sampleVelocity * 0.3; // light smoothing
        lastMoveX = ev.clientX;
        lastMoveT = now;
      }
    }
    // A bare hover does nothing: the focus is the view centre, not the pointer.
  });
  const endDrag = (ev: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    el.releasePointerCapture(ev.pointerId);
    el.classList.remove("timeline--grabbing");
    // Carry a horizontal fling only when the release follows live motion (not a
    // pause-lift); otherwise rest. Any Y return is driven by that sideways glide.
    const fling = performance.now() - lastMoveT < STALE_RELEASE_MS && Math.abs(velocity) > MIN_FLING_V;
    if (!fling) velocity = 0;
    if (Math.abs(panY) <= TRACK_CAPTURE_PX) panY = 0;
    startAnim();
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);

  return {
    el,
    axis: () => axis,
    setCards: (elements) => cards.replaceChildren(...elements),
    setContentDepth: (above, below) => {
      aboveDepth = above;
      belowDepth = below;
      panY = clampY(panY);
      if (Math.abs(panY) <= TRACK_CAPTURE_PX) panY = 0;
      applyPan();
    },
    centerOn(date) {
      const target = targetPanForDate(date);
      if (target === null) return;
      stopAnim(); // navigation is authoritative — kill any glide/spring in flight
      panX = target;
      applyPan(); // emits the new view date through onView
    },
    warpTo(date) {
      const target = targetPanForDate(date);
      if (target === null) return;
      stopAnim();
      velocity = 0;
      const startX = panX;
      const startY = panY;
      const distance = target - startX;
      if (Math.abs(distance) < SPRING_SNAP_PX && Math.abs(startY) < SPRING_SNAP_PX) {
        panX = target;
        panY = 0;
        applyPan();
        return;
      }

      const duration = warpDuration(distance);
      const startT = performance.now();
      const step = (t: number) => {
        const progress = Math.min(1, (t - startT) / duration);
        const eased = easeInOutSmootherstep(progress);
        panX = startX + distance * eased;
        panY = startY * (1 - eased);
        applyPan();
        anim = progress < 1 ? requestAnimationFrame(step) : 0;
      };
      anim = requestAnimationFrame(step);
    },
    layout(nextExtent, todayDate) {
      extent = nextExtent;
      if (!extent) {
        axis = null;
        content.style.width = "0px";
        today.style.display = "none";
        return;
      }
      // Pad the origin so the first event isn't flush against the left edge.
      axis = createAxis({ origin: addDays(extent[0], -PAD_DAYS), pxPerDay: PX_PER_DAY });
      content.style.width = `${axis.xForDate(extent[1]) + PAD_DAYS * PX_PER_DAY}px`;

      // First load lands centred on today; later layouts (recompute or resize)
      // re-centre on the held centre — so growing the window expands out from the
      // middle instead of padding the right edge, and the pan is otherwise kept.
      if (!centered) {
        centerX = axis.xForDate(todayDate);
        centered = true;
      }
      panX = el.clientWidth / 2 - centerX;
      const { min, max } = panBounds();
      panX = Math.max(min, Math.min(max, panX)); // clamp inside the walls (hard, no spring)
      // Force `onView` to re-fire even if the centre date is unchanged: a resize
      // rebuilds the minimap axis, so its window must re-sync against the new
      // scale regardless of whether the date rounded the same.
      viewDate = null;
      applyPan(); // emits the centre date → refreshes the menubar + minimap window

      today.style.display = "";
      today.style.left = `${axis.xForDate(todayDate)}px`;
    },
  };
}
