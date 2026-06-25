/**
 * Spatial culling (Trackblazer) — the known-scene → live-DOM layer. Holds every
 * card's retained element plus its measured world-x bounds, and mounts only the
 * slice inside a content-space window the camera hands it. It is **camera-agnostic**:
 * it never sees pan or zoom; the timeline converts the viewport to a content-space
 * window and passes the edges in, so all the conversion math stays in one place.
 * Also owns the churn meter on its card host.
 */

import { h } from "../../h.ts";
import type { SceneCard, VisibilityStats } from "./types.ts";

/** A scene object's retained element plus its measured world-x bounds (content
 *  space, camera-independent). The known-scene layer between selectors and the live
 *  DOM: the element exists whether or not it is currently mounted. */
interface SceneObject {
  id: string;
  el: HTMLElement;
  left: number;
  right: number;
}

export interface Culling {
  /** The card host to mount into the panning content layer. */
  readonly host: HTMLElement;
  /** Raw all-mounted mode: mount every element and disarm culling (empty scene), so
   *  a `reconcile` during the measure window is inert until `arm` re-arms it. */
  mountAll(elements: HTMLElement[]): void;
  /** Arm culling: measure each card's world-x bounds relative to `contentLeft` and
   *  mark every card mounted. The caller must have the content layer rendered
   *  unscaled so `getBoundingClientRect` reads true content space; it reconciles to
   *  the live window itself afterwards. */
  arm(cards: SceneCard[], contentLeft: number): void;
  /** Mount cards entering the content-space window `[left, right]`, detach cards
   *  leaving it. Pure arithmetic against precomputed bounds — reads no geometry, so
   *  it forces no reflow and stays on the cheap camera path. Inert until `arm`. */
  reconcile(left: number, right: number): void;
  /** The gating measurement over the *known scene* (not the mounted DOM, so it stays
   *  correct once culling has unmounted the offscreen cards): how many cards fall
   *  inside the window, the overscan near-band, or beyond. */
  visibility(viewLeft: number, viewRight: number, overscan: number): VisibilityStats;
  /** Read + reset the DOM node churn (nodes added + removed under the host) since the
   *  last call — the HUD's per-frame cull-turnover bucket. */
  drainChurn(): number;
}

export function createCulling(): Culling {
  // The known scene + the live mounted set. `scene` holds every card's retained
  // element and world-x bounds; `mountedIds` is which of them are currently in the
  // DOM. Empty `scene` = culling disarmed (raw all-mounted mode) so `reconcile` is
  // inert until `arm` arms it.
  let scene: SceneObject[] = [];
  const mountedIds = new Set<string>();
  const host = h("div", { class: "timeline__cards" }); // hosts the positioned card views

  // Churn meter: count DOM nodes added/removed under the card host. ~0 on the camera
  // path — pan/warp are pure transforms, they don't touch childList — so it
  // establishes the "no churn while panning" baseline the cull/pool work must not
  // regress. A domain recompute's `replaceChildren` spikes it (the expensive commit
  // path, expected); `subtree` catches in-place card-internal rebuilds too.
  let pendingChurn = 0;
  new MutationObserver((records) => {
    for (const r of records) pendingChurn += r.addedNodes.length + r.removedNodes.length;
  }).observe(host, { childList: true, subtree: true });

  return {
    host,
    mountAll(elements) {
      scene = [];
      mountedIds.clear();
      host.replaceChildren(...elements);
    },
    arm(cards, contentLeft) {
      // CONTAINED EXCEPTION to camera-measurement invariant C-B6 (grand-masters/contracts.md):
      // this still reads getBoundingClientRect because it measures content-space *position*
      // (left/right), not size — the offset-based equivalent depends on the offsetParent frame,
      // and the failure (mis-windowed cull → wrong pop-in/out) is unobserved to date. Named here
      // as a reasoned exception, not a silent latent violation. Don't "fix" this with an offset
      // swap — the intended resolution is the frustum reframe (bounds from the packer's known
      // world coords, tested against the camera frustum; no DOM rect to measure). See C-B6.
      // Subtracting the content layer's own rect cancels the pan offset; the caller
      // guarantees scale 1, so the rect is true content space. One viewport of
      // overscan dwarfs any sub-card centring error, so this is plenty exact.
      scene = cards.map(({ id, el }) => {
        const r = el.getBoundingClientRect();
        return { id, el, left: r.left - contentLeft, right: r.right - contentLeft };
      });
      mountedIds.clear();
      for (const { id } of cards) mountedIds.add(id);
    },
    reconcile(left, right) {
      if (scene.length === 0) return;
      for (const o of scene) {
        const inWindow = o.right >= left && o.left <= right;
        const mounted = mountedIds.has(o.id);
        if (inWindow && !mounted) {
          host.appendChild(o.el); // zIndex is set per-card by the packer, so DOM order is free
          mountedIds.add(o.id);
        } else if (!inWindow && mounted) {
          o.el.remove();
          mountedIds.delete(o.id);
        }
      }
    },
    visibility(viewLeft, viewRight, overscan) {
      if (scene.length === 0) return { total: 0, visible: 0, near: 0, offscreen: 0 };
      let visible = 0;
      let near = 0;
      let offscreen = 0;
      for (const o of scene) {
        if (o.right >= viewLeft && o.left <= viewRight) visible += 1;
        else if (o.right >= viewLeft - overscan && o.left <= viewRight + overscan) near += 1;
        else offscreen += 1;
      }
      return { total: scene.length, visible, near, offscreen };
    },
    drainChurn() {
      const n = pendingChurn;
      pendingChurn = 0;
      return n;
    },
  };
}
