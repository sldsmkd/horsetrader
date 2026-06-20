/**
 * The timeline substrate — the always-mounted, grabbable time-as-x world that is
 * the core representation *and* the primary navigation (ui.md principle 1). x is
 * true-to-date through the axis primitive (principle 2): a gap is a real gap.
 * This is the first real consumer of `axis.ts`, and where the step-3 standalone
 * scrub retires. As of 4f the focus is the view centre itself — there is no
 * separate cursor; panning *is* re-focusing.
 *
 * It owns the **transient interaction-state** — the pan offset and zoom scale — and
 * writes it **straight to the DOM** (a CSS transform), emitting the view-centre date
 * via `onView` for the menubar + minimap window. There is deliberately no broadcast
 * `subscribe` here, so a 60 Hz pan **structurally cannot** enter the render path
 * (docs/frontend/interaction.md, the two-tier change model). The render path is the
 * separate `layout()`, driven by the coordinator subscription.
 *
 * This file is the pan/zoom/momentum state machine; the cohesive pieces live beside
 * it: `timeline/constants.ts` (feel knobs), `timeline/types.ts` (public contract),
 * `timeline/motion.ts` (pure math), `timeline/culling.ts` (the scene → live-DOM
 * layer + churn meter).
 */

import "./timeline.css";

import { h } from "../h.ts";
import { createAxis } from "../axis.ts";
import type { Axis } from "../axis.ts";
import { addDays } from "../../core/projection/dates.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";

import {
  AXIS_COMMIT_PX,
  FRICTION_PER_MS,
  MIN_FLING_V,
  MIN_GLIDE_V,
  OVERSCAN_VIEWPORTS,
  PAD_DAYS,
  PX_PER_DAY,
  SPRING_EASE,
  SPRING_SNAP_PX,
  STALE_RELEASE_MS,
  TRACK_CAPTURE_PX,
  TRACK_DERAIL_BIAS,
  TRACK_DERAIL_PX,
  TRACK_GRIP_FALLOFF_PX,
  TRACK_GRIP_MIN,
  TRACK_MIN_TRAVEL_VIEWPORT,
  TRACK_RETURN_MAX_EASE,
  TRACK_RETURN_SPEED_PX_PER_MS,
  WHEEL_ZOOM_SENSITIVITY,
  Z_FIT_FLOOR,
  Z_MIN_BASE,
  Z_MAX,
} from "./timeline/constants.ts";
import { apertureHeightPx, resolveLengthPx } from "../glassUnit.ts";
import { clampDate, easeInOutSmootherstep, rubber, warpDuration } from "./timeline/motion.ts";
import { createCulling } from "./timeline/culling.ts";
import type { Extent, Timeline, TimelineHandlers } from "./timeline/types.ts";

export type { Extent, SceneCard, Timeline, TimelineHandlers, VisibilityStats } from "./timeline/types.ts";

export function timeline({ onView }: TimelineHandlers): Timeline {
  // Transient interaction-state, owned here and written directly — never broadcast.
  let panX = 0;
  let panY = 0; // vertical peek offset; rests at 0 (the line recentred)
  let z = 1; // camera scale (zoom.md): apparent altitude, world layout is fixed
  // The commit/measurement window (setCards → pack → setScene) renders unscaled so
  // every `getBoundingClientRect` in the packer reads true geometry, not z-scaled
  // rects — otherwise a recompute while zoomed (e.g. starring a card) mis-packs and
  // mis-bounds the whole timeline. `z` is restored at setScene. It never paints
  // mid-window (the sequence is synchronous), so the unscaled frame is invisible.
  let measuring = false;
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
  // The zoomed-out floor, DERIVED per display (Darley #3) rather than a fixed constant:
  // fit the full world vertical extent into the usable aperture. Recomputed whenever the
  // extent or the viewport changes (setContentDepth, which the resize path also drives).
  // Defaults to the eye-tuned baseline overview pull-back; before any content there's
  // nothing to fit-derive against, so the baseline stands until setContentDepth deepens it.
  let zMin = Z_MIN_BASE;

  const culling = createCulling(); // owns the card host, the known scene, and the churn meter
  const line = h("div", { class: "timeline__line" });
  const today = h("div", { class: "timeline__today" });
  const content = h("div", { class: "timeline__content" }, line, today, culling.host);
  const rail = h("div", { class: "timeline__rail", attr: { "aria-hidden": "true" } });
  const el = h("section", { class: "timeline", attr: { "aria-label": "Timeline" } }, rail, content);
  // The rail's screen-fixed extent in px (Darley #4), resolved from the single CSS source
  // `--timeline-rail-height` (glass-u, timeline.css) through the glass-u→px bridge — the
  // SAME measure the band paints. Cached and refreshed on view changes (refreshMetrics,
  // called from layout) since glass-u tracks the viewport; resolving forces layout, so
  // never per-frame. The gesture math (panBoundsY) reads this, not a constant, so the
  // visual rail and the derail boundary can't drift into two unit systems.
  let railVisualPx = 0; // set on first layout, before any gesture can read it
  const refreshMetrics = () => {
    railVisualPx = resolveLengthPx(el, "var(--timeline-rail-height)");
    // Fail loud: this IS the CSS-to-device calibration bridge. A zero/NaN here means the
    // single source (`--timeline-rail-height`) was removed or folded back to a constant —
    // exactly the drift the seam exists to prevent. Don't silently fall back to a number.
    if (!(railVisualPx > 0)) {
      throw new Error("timeline: --timeline-rail-height did not resolve to px (glass-u bridge broken)");
    }
  };

  // Screen↔content axis mapping under the camera transform (zoom.md conversion
  // spine). The axis primitive works in content space and never sees `z`; every
  // screen-space measurement routes through here so a single `scale(z)` stays
  // consistent. At `z === 1` this collapses to the old `- panX` arithmetic.
  const screenToContentX = (sx: number) => (sx - panX) / z;
  // Convert the viewport (+ overscan) to a content-space window and reconcile the
  // live set against it. The viewport spans `clientWidth / z` of world, so the
  // overscan span scales with altitude too (zoom.md). Pure arithmetic — no reflow.
  const reconcile = () => {
    const overscan = (el.clientWidth / z) * OVERSCAN_VIEWPORTS;
    culling.reconcile(screenToContentX(0) - overscan, screenToContentX(el.clientWidth) + overscan);
  };

  const applyPan = () => {
    // `scale(z)` reaches exactly the cards + in-world markers inside content and
    // nothing mounted as a sibling (zoom.md Model). `--zoom` lets infinitely-thin
    // elements (home row, stems) counter-scale their cross-axis thickness so a 1px
    // tick stays 1px on screen at every altitude. During the measurement window the
    // effective scale is forced to 1 so the packer measures true geometry — but this
    // is a transient *visual* render only; the camera's logical zoom stays `z`.
    const az = measuring ? 1 : z;
    content.style.transform = `translate(${panX}px, ${panY}px) scale(${az})`;
    content.style.setProperty("--zoom", `${az}`);
    // Track the exact content-space x under the viewport middle, so a resize can
    // re-centre on it (grow out from the centre, not pad the right edge). Uses the
    // real `z`, never `az`: this is where the camera points, independent of the
    // measurement render — otherwise the centre date (and the scenario art it drives)
    // would flip on every recompute.
    centerX = screenToContentX(el.clientWidth / 2);
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
    // The camera moved → bring the live set back in step with the new viewport.
    reconcile();
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

  // --- pinch-zoom: a second pointer promotes the gesture from pan to two-pointer
  // zoom (zoom.md Input). `pointers` tracks every live pointer so the existing
  // single-pointer pan and the two-pointer pinch share one capture set. Pinch derives
  // `z` from the pointer-distance ratio and anchors the content point under the
  // gesture midpoint, which also lets the two fingers pan together. ---
  const pointers = new Map<number, { x: number; y: number }>();
  let pinching = false;
  let pinchDist0 = 1; // pointer separation at pinch start
  let pinchZ0 = 1; // z at pinch start
  let pinchCx = 0; // content-x under the midpoint at pinch start (held fixed)
  let pinchCyc = 0; // content-y offset (from centre) under the midpoint at pinch start
  let pinchRectLeft = 0; // viewport's screen-left, for clientX → local x
  let pinchRectTop = 0; // viewport's screen-top, for clientY → local y
  const beginPinch = () => {
    pinching = true;
    dragging = false; // a pan in progress yields to the pinch
    stopAnim();
    const [a, b] = [...pointers.values()];
    const rect = el.getBoundingClientRect();
    pinchRectLeft = rect.left;
    pinchRectTop = rect.top;
    pinchDist0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    pinchZ0 = z;
    pinchCx = screenToContentX((a.x + b.x) / 2 - pinchRectLeft);
    pinchCyc = screenToContentYOffset((a.y + b.y) / 2 - pinchRectTop);
    el.classList.add("timeline--grabbing");
  };

  // The horizontal pan range that keeps content on screen: 0 holds the start edge
  // at the viewport's left; the (negative) min holds the end edge at its right.
  // Content narrower than the viewport has no travel — both clamp to 0.
  const panBounds = () => {
    // `offsetWidth` is the unscaled layout width; the on-screen world is `z` times
    // that, so the wall that holds the end edge at the viewport right scales too.
    const min = Math.min(0, el.clientWidth - z * content.offsetWidth);
    return { min, max: 0 };
  };
  // The vertical well. Lane overflow can extend it, but it always has a minimum
  // viewport-sized run so the track can derail even when cards currently fit.
  // Rest is wherever the user left the lane, unless the rail recaptures.
  const panBoundsY = () => {
    const half = el.clientHeight / 2;
    const minTravel = Math.max(TRACK_DERAIL_PX + railVisualPx / 2, el.clientHeight * TRACK_MIN_TRAVEL_VIEWPORT);
    // The vertical drag range is the default-zoom (z=1) range, scaled by `z` — so
    // the well stretches/contracts in proportion to altitude rather than re-deriving
    // a different overflow at each zoom. The minTravel floor is part of the base
    // range, so it scales too (stays well above the derail threshold across the
    // narrow z span).
    const maxBase = Math.max(minTravel, aboveDepth - half);
    const minBase = Math.max(minTravel, belowDepth - half);
    return { min: -z * minBase, max: z * maxBase };
  };
  const verticalOffset = () => {
    const { min, max } = panBoundsY();
    const range = panY >= 0 ? max : -min;
    return range > 0 ? Math.max(-1, Math.min(1, panY / range)) : 0;
  };
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
    // Put the date's content-x under the viewport centre: solve contentToScreenX(cx)
    // = clientWidth/2 for panX (so the `z` term rides along).
    return Math.max(min, Math.min(max, el.clientWidth / 2 - z * axis.xForDate(date)));
  };
  const clampZ = (raw: number) => Math.max(zMin, Math.min(Z_MAX, raw));
  const clampPanX = (raw: number) => {
    const { min, max } = panBounds();
    return Math.max(min, Math.min(max, raw));
  };
  // Content-y offset from the centre line under a viewport-local y, given the
  // current camera. Vertical scaling pivots about the centre line (transform-origin
  // `0 50%`), so screen_y = panY + half + z·cyc; this inverts it for the anchor.
  const screenToContentYOffset = (sy: number) => (sy - panY - el.clientHeight / 2) / z;
  // Zoom anchored under a viewport-local point: hold the content point currently
  // beneath the anchor fixed across the scale change — on *both* axes, so zooming
  // toward the cursor keeps the card under it pinned rather than letting it balloon
  // out of the centre-line origin (zoom.md Anchor + Vertical). Hard-clamps pan (no
  // rubber) — zoom is a deliberate camera move, not a drag.
  const setZoom = (nextZ: number, anchorScreenX: number, anchorScreenY: number) => {
    const clamped = clampZ(nextZ);
    if (clamped === z) return;
    const cx = screenToContentX(anchorScreenX); // content point under the anchor, before
    const cyc = screenToContentYOffset(anchorScreenY);
    z = clamped;
    panX = clampPanX(anchorScreenX - z * cx); // keep that point under the anchor, after
    panY = clampY(anchorScreenY - el.clientHeight / 2 - z * cyc);
    applyPan();
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
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    el.setPointerCapture(ev.pointerId);
    if (pointers.size >= 2) {
      beginPinch(); // second finger down → promote to pinch-zoom
      return;
    }
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
    el.classList.add("timeline--grabbing");
  });
  el.addEventListener("pointermove", (ev) => {
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinching && pointers.size >= 2) {
      // Two-pointer transform: scale from the live distance ratio, and slide pan so
      // the start midpoint's content-x stays under the live midpoint (zoom.md Anchor).
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const midX = (a.x + b.x) / 2 - pinchRectLeft;
      const midY = (a.y + b.y) / 2 - pinchRectTop;
      z = clampZ(pinchZ0 * (dist / pinchDist0));
      panX = clampPanX(midX - z * pinchCx);
      panY = clampY(midY - el.clientHeight / 2 - z * pinchCyc);
      applyPan();
      return;
    }
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
    pointers.delete(ev.pointerId);
    if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    if (pinching) {
      // A pinch ends when the second finger lifts. If one finger remains, hand the
      // gesture back to pan — re-grab from where that pointer is now so there's no
      // jump — otherwise the gesture is over.
      if (pointers.size >= 2) return; // still pinching with a leftover pointer set
      pinching = false;
      const remaining = [...pointers.values()][0];
      if (remaining) {
        dragging = true;
        axisLock = Math.abs(panY) > TRACK_CAPTURE_PX ? "free" : "none";
        grabX = remaining.x;
        grabY = remaining.y;
        grabPanY = panY;
        velocity = 0;
        lastMoveX = remaining.x;
        lastMoveT = performance.now();
        viewDate = null;
      } else {
        el.classList.remove("timeline--grabbing");
      }
      return;
    }
    if (!dragging) return;
    dragging = false;
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

  // Ctrl/Cmd + wheel zooms about the pointer (zoom.md Input). Plain wheel is left
  // alone — the timeline has no native scroll to hijack. `passive: false` so the
  // browser's own ctrl+wheel page zoom is preempted on the timeline.
  el.addEventListener(
    "wheel",
    (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      stopAnim();
      const rect = el.getBoundingClientRect();
      setZoom(z * Math.exp(-ev.deltaY * WHEEL_ZOOM_SENSITIVITY), ev.clientX - rect.left, ev.clientY - rect.top);
    },
    { passive: false },
  );

  return {
    el,
    axis: () => axis,
    setCards: (elements) => {
      // Raw all-mounted mode: the shell needs every card laid out so the packer can
      // measure it. The culler disarms (empty scene) until `setScene` re-arms it.
      // Enter the unscaled measurement window (only when there's something to
      // measure — an empty set has no setScene to restore zoom) and render it now so
      // the packer's getBoundingClientRect reads true, un-zoomed geometry.
      culling.mountAll(elements);
      measuring = elements.length > 0;
      applyPan();
    },
    setScene(sceneCards) {
      // Arm culling: the packer has settled stem heights / group nudges, the elements
      // are mounted, and the content layer is still rendered unscaled (the measurement
      // window), so the measured rects are true content space. Leave the measurement
      // window (restore real scale(z)) and let applyPan cull down to the window.
      culling.arm(sceneCards, content.getBoundingClientRect().left);
      measuring = false;
      applyPan();
    },
    visibility(overscanPx) {
      // Work in content space (where the scene bounds live): convert the screen-px
      // overscan and the viewport edges through the camera so the count stays right
      // once zoom has changed how much world the viewport spans.
      const overscan = (overscanPx ?? el.clientWidth) / z;
      return culling.visibility(screenToContentX(0), screenToContentX(el.clientWidth), overscan);
    },
    drainChurn: () => culling.drainChurn(),
    setContentDepth: (above, below) => {
      aboveDepth = above;
      belowDepth = below;
      // Derive the zoomed-out floor (Darley #3) from the fit of the world's full vertical
      // extent into the usable aperture. Phrased in world/camera terms, not display class:
      // zFit is how much the camera must shrink so the densest packing (above + below the
      // centre line — the global extent, stable across pans) fits the aperture height, then
      // bound it. The aperture (viewport − persistent chrome, resolved to px here) is the
      // honest input — never a nominal "1440p". Recomputed here so the resize path (which
      // re-runs this) re-fits when the viewport height changes.
      // zFit is the zoom at which the world's full vertical extent exactly fills the
      // aperture. The floor sits at the eye-tuned baseline (Z_MIN_BASE) and only DEEPENS
      // toward Z_FIT_FLOOR when even that baseline can't fit the world (cramped viewport);
      // it never rises above the baseline, so a roomy display keeps its overview pull-back.
      const worldExtent = aboveDepth + belowDepth;
      const zFit = worldExtent > 0 ? apertureHeightPx() / worldExtent : Z_MIN_BASE;
      zMin = Math.max(Z_FIT_FLOOR, Math.min(Z_MIN_BASE, zFit));
      z = clampZ(z); // a tighter floor may strand the current zoom below it
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
      // Refresh screen-space metrics first: layout runs on first mount and on every
      // resize, and glass-u (hence the rail extent) tracks the viewport. Before the
      // extent guard so the rail px is current even when the timeline is empty.
      refreshMetrics();
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
      panX = el.clientWidth / 2 - z * centerX;
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
