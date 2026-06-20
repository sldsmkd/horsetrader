/**
 * Timeline tuning constants — the feel knobs for the substrate's pan momentum,
 * elastic walls, the centre-line railtrack, warp navigation, spatial culling, and
 * optical-scale zoom. Pulled out of `timeline.ts` so the state machine reads as
 * behaviour, not numbers. All eye-tuned unless noted.
 */

/** World-plane card stacking order. Below-lane cards that pack into deeper rows paint
 *  BEHIND shallower ones, so each card's z-index counts DOWN from this top by its pack
 *  offset (`STACK_TOP - offset`). This is the *world* plane's own paint order — distinct
 *  from, and deliberately outside, the glass depth ladder (`--glass-z-*` in glass.css),
 *  which orders the chrome/surfaces that float over the world. The top is set high
 *  enough that the deepest stack never underflows past 0 into the world layer below. */
export const BELOW_LANE_STACK_TOP = 1000;

/** Px per day — the fixed true-to-date *layout* scale (ui.md principle 2); zoom is a
 *  camera scale on top, not a change to this. A date-gap should read as room, not a
 *  crush: at this scale a 2-day gap (240px) clears a full + compact card pair
 *  (collision ~220px) so the slimmer card sits flush. */
export const PX_PER_DAY = 120;
/** Breathing room (days) padded either side of the data extent — the prototype's
 *  fixed buffer before the first card and after the last. */
export const PAD_DAYS = 3;

/** Pan momentum, tuned for feel: per-ms velocity decay, the flick floor to start
 *  a glide at release, the floor at which the glide ends, and the pause-before-
 *  release window past which a lift is not a flick. */
export const FRICTION_PER_MS = 0.9975;
export const MIN_FLING_V = 0.05; // px/ms
export const MIN_GLIDE_V = 0.015; // px/ms
export const STALE_RELEASE_MS = 60;

/** Elastic walls: the rubber-band tension when dragging past an end (lower =
 *  stiffer), the per-frame ease fraction the spring-back uses to recentre on the
 *  wall, and the px within which the spring snaps home. */
export const RUBBER_TENSION = 0.55;
export const SPRING_EASE = 0.18;
export const SPRING_SNAP_PX = 0.5;

/** Axis-intent lock: a drag commits to horizontal after this much travel. The
 *  railtrack constants below decide when a vertical gesture deliberately derails. */
export const AXIS_COMMIT_PX = 8;
/** The centre line is a railtrack, not a spring: it takes a deliberate vertical
 *  shove to derail, and once derailed the lane offset persists. Passing back
 *  through the capture band snaps onto the rail again. */
export const TRACK_DERAIL_PX = 42;
export const TRACK_CAPTURE_PX = 2;
export const TRACK_RAIL_VISUAL_PX = 32;
export const TRACK_DERAIL_BIAS = 1.15;
export const TRACK_MIN_TRAVEL_VIEWPORT = 0.35;
export const TRACK_RETURN_SPEED_PX_PER_MS = 2.4;
export const TRACK_RETURN_MAX_EASE = 0.11;
export const TRACK_GRIP_FALLOFF_PX = 320;
export const TRACK_GRIP_MIN = 0.32;

/** Deliberate navigation ("warp") timing. Short hops should feel crisp; long
 *  jumps should visibly travel without making the user wait through the whole
 *  distance. The exponential distance curve approaches the max instead of
 *  growing without bound. */
export const WARP_MIN_MS = 650;
export const WARP_MAX_MS = 1500;
export const WARP_DISTANCE_SCALE_PX = 4000;

/** Spatial culling overscan (Trackblazer): how far past each viewport edge a card
 *  stays mounted, as a multiple of the viewport width. One viewport each side is
 *  the measured near-band (appendix), so the live set is the gating measurement's
 *  visible + near (~35 at the worst frame) — generous enough that a sub-card error
 *  in a card's measured world bounds can never pop a card in late under a pan. This
 *  serves the *pan* path; warp transit is a separate concern (design.md Culling). */
export const OVERSCAN_VIEWPORTS = 1;

/** Optical-scale zoom (Trackblazer zoom.md). `z` is a camera scalar applied as
 *  `scale(z)` on the content layer — the world layout never changes, only apparent
 *  altitude. The clamp is a 2D-game-camera min/max: zMin is the zoomed-out floor
 *  (the whole thing still fits comfortably), zMax the zoomed-in ceiling (cards
 *  readably large). The range is deliberately narrow (zoom.md Bounds); both ends
 *  are eye-tuned, not derived. */
export const Z_MIN = 0.6;
export const Z_MAX = 1.8;
/** Wheel-zoom feel: deltaY → multiplicative zoom factor via `exp`, so each notch
 *  is a constant proportional step (symmetric in/out) rather than additive. */
export const WHEEL_ZOOM_SENSITIVITY = 0.0015;
