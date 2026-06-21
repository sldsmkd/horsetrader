/**
 * The timeline substrate's public contract: the handle the shell drives, the
 * handlers it supplies, and the value types they exchange. Kept separate from the
 * implementation so the shell can depend on the shape without the state machine.
 */

import type { Axis } from "../../axis.ts";
import type { CalendarDate } from "../../../core/projection/dates.ts";

/** A balance-series extent (earliest, latest), or `null` for an empty world. */
export type Extent = readonly [CalendarDate, CalendarDate] | null;

/**
 * The gating measurement (see trackblazer/design.md): of the known scene, how many
 * cards fall inside the viewport, in the near-band overscan, or fully offscreen.
 * Counts are over precomputed world bounds, so the camera transform (pan + zoom) is
 * already converted out — no need to reason about `panX`/`z` here.
 */
export interface VisibilityStats {
  total: number;
  visible: number;
  near: number;
  offscreen: number;
}

/**
 * The pairing the shell hands the substrate to arm spatial culling: a stable id
 * (the card/group key) and its built element. The timeline measures each element's
 * world bounds once (at arm time, after the packer has settled heights/nudges) and
 * thereafter mounts only the slice inside the viewport + overscan, keying the live
 * set by id so a pan that shifts every card reconciles by membership, not position.
 */
export interface SceneCard {
  id: string;
  el: HTMLElement;
}

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
   * Arm spatial culling: record each card's world-x bounds (measured once, now, so
   * the packer's settled heights/nudges are already baked in) and reconcile the live
   * set down to the viewport + overscan slice. Call **after** `setCards` mounted the
   * full set and the packer ran — the measure needs the cards laid out. From here the
   * camera path (`applyPan`) keeps the mounted set in step with the viewport by key,
   * so a 618-card world only ever paints its visible neighbourhood (~35 cards).
   */
  setScene(cards: SceneCard[]): void;
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
  /**
   * Count the mounted cards by where they fall relative to the viewport — the
   * Trackblazer gating measurement. `overscanPx` is the near-band buffer each side
   * (default: one viewport width); cards inside it but off the visible rect count
   * as `near`, everything beyond as `offscreen`. A cheap-enough diagnostic read
   * (one batched reflow); call it off the HUD sample tick, not per frame.
   */
  visibility(overscanPx?: number): VisibilityStats;
  /**
   * Read and reset the DOM node churn (nodes added + removed under the card host)
   * accumulated since the last call. The HUD calls this once per frame to bucket
   * churn by frame for its high-watermark / percentile pass. Pre-culling it reads 0
   * during pan/warp — the baseline the cull/pool path must not regress.
   */
  drainChurn(): number;
  /**
   * The benchmark drive seam (UmaMark, grand-masters/umamark.md) — dev-only, gated
   * behind the `?umamark` flag at the call site. UmaMark scripts the camera directly,
   * frame by frame, instead of through `warpTo` (whose glide physics would make the
   * motion non-deterministic). It owns no loop of its own — UmaMark's rAF drives it.
   */
  readonly bench: BenchControl;
}

/**
 * The deterministic-camera controls UmaMark drives. All in screen px at the current
 * (fitted) zoom: a sweep walks `panX` from `0` (start edge at the viewport left) to
 * `panMin()` (end edge at the right) and back, advancing a fixed screen-width fraction
 * per frame. Setting `panX` re-renders (transform + cull reconcile) synchronously, so
 * the perf instrument's own tick times the resulting frame.
 */
export interface BenchControl {
  /** Put the camera at the canonical run start: scene-start edge, fitted/overview zoom,
   *  lane recentred. Every run begins identically regardless of the user's prior view. */
  reset(): void;
  /** The current applied horizontal pan offset, px. */
  panX(): number;
  /** The most-negative pan (end edge held at the viewport right) at the current zoom. */
  panMin(): number;
  /** Set the horizontal pan directly (clamped to the walls) and re-render now. */
  setPanX(px: number): void;
  /** The viewport width in px — the unit a screen-width-relative step is measured against. */
  viewportWidth(): number;
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
