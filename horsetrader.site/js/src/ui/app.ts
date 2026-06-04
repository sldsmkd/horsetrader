/**
 * The app shell: the one place that knows the wiring. It builds the view tree
 * once and drives the two-tier change model (docs/frontend/interaction.md).
 *
 *   - **Cheap path:** the timeline owns the transient cursor/pan and pushes the
 *     cursor date straight here via `onScrub`; we read `balanceAt` and write the
 *     readout — no recompute, no broadcast, no rebuild.
 *   - **Render path:** a domain mutation (editing the snapshot in the Account
 *     overlay) recomputes and notifies; we re-lay the timeline for the new
 *     extent, which re-emits the cursor date through `onScrub` and so refreshes
 *     the readout against the fresh projection. Rare, so a full re-layout is fine.
 *   - **Discrete view-state:** the menubar toggles which overlay is open through
 *     the view-state store's `subscribe`; the timeline stays live behind it
 *     (ui.md principle 1, via the `pointer-events: none` overlay layer).
 *
 * As of 4b the standalone step-3 scrub `<input>` is gone: the timeline substrate
 * is the real owner of cursor/scrub. No state is read back out of the DOM.
 */

import { h, qs } from "./h.ts";
import { cursorBalance } from "./views/cursorBalance.ts";
import { timeline } from "./views/timeline.ts";
import { belowCard } from "./views/belowCard.ts";
import { bannerGroup } from "./views/bannerGroup.ts";
import { overlay } from "./views/overlay.ts";
import { belowLaneCards } from "./select/belowLane.ts";
import { aboveLaneGroups } from "./select/aboveLane.ts";
import { packBelow, packAbove } from "./pack/pack.ts";
import type { BelowCard } from "./select/belowLane.ts";
import type { BannerGroup } from "./select/aboveLane.ts";
import { createViewStore } from "./state/viewState.ts";
import type { Coordinator } from "../core/coordinator/index.ts";
import type { Bundle } from "./bundle/access.ts";

/** Below-lane collision spacing (content px): horizontal breathing room between
 *  neighbours, and the vertical gap between stacked cards. Tune by eye. */
const BELOW_GAP_X = 10;
const BELOW_GAP_Y = 6;
/** Above-lane horizontal breathing room between adjacent banner groups (px). */
const ABOVE_GAP = 8;

/**
 * The packer's impure bookend: measure the just-mounted below cards once, run the
 * pure `packBelow` geometry, then apply each offset by **growing the stem** — so
 * the body drops to its packed row while the stem still reaches its true-date tick
 * (principle 4). The card width is uniform (CSS), so one measurement sets the
 * collision width; heights are per-card body heights. Shallower cards sit on top.
 * Returns how far the deepest card reaches below the line (px) — the lane's floor.
 */
function packBelowLane(cards: readonly BelowCard[], els: readonly HTMLElement[]): number {
  if (els.length === 0) return 0;
  const stems = els.map((el) => el.querySelector(".card__stem") as HTMLElement);
  const bodies = els.map((el) => el.querySelector(".card__body") as HTMLElement);
  const width = els[0].getBoundingClientRect().width;
  const baseStem = stems[0].getBoundingClientRect().height;
  const heights = bodies.map((b) => b.getBoundingClientRect().height);
  const boxes = cards.map((card, i) => ({ x: card.x, height: heights[i] }));

  const offsets = packBelow(boxes, { width, gapX: BELOW_GAP_X, gapY: BELOW_GAP_Y });
  let depth = 0;
  offsets.forEach((offset, i) => {
    stems[i].style.height = `${baseStem + offset}px`;
    els[i].style.zIndex = String(Math.round(1000 - offset)); // shallower rows in front
    depth = Math.max(depth, baseStem + offset + heights[i]); // distance from the line to this card's bottom
  });
  return depth;
}

/**
 * The above-lane bookend: measure the just-mounted banner-group bodies, run the
 * pure `packAbove` sweep, then apply each nudge as a translateX on the *body* (the
 * `.banner-group`) — the stem stays on the true-date tick while crowded groups
 * drift right (principle 4). Returns the tallest group's height (px) — the lane's
 * roof, for the timeline's vertical bounds.
 */
function packAboveLane(groups: readonly BannerGroup[], els: readonly HTMLElement[]): number {
  if (els.length === 0) return 0;
  const bodies = els.map((el) => el.querySelector(".banner-group") as HTMLElement);
  const boxes = groups.map((group, i) => ({ x: group.x, width: bodies[i].getBoundingClientRect().width }));

  const nudges = packAbove(boxes, ABOVE_GAP);
  let roof = 0;
  nudges.forEach((nudge, i) => {
    bodies[i].style.transform = nudge ? `translateX(${nudge}px)` : "";
    roof = Math.max(roof, bodies[i].getBoundingClientRect().height);
  });
  return roof;
}

/**
 * The displayed-card date range: earliest to latest arrival across *all* known
 * events, or null when none. The timeline spans all known time — start of history
 * to the last scheduled event — not the balance-series/projection horizon (you
 * scroll back into the past too). Cards anchor at `start`, so both ends measure
 * `start`: the latest *end* would trail dead time past the final card.
 */
function displayExtent(bundle: Bundle): readonly [string, string] | null {
  let lo: string | null = null;
  let hi: string | null = null;
  for (const ev of bundle.all()) {
    if (lo === null || ev.start < lo) lo = ev.start;
    if (hi === null || ev.start > hi) hi = ev.start;
  }
  return lo === null ? null : [lo, hi as string];
}

export function mountApp(coord: Coordinator, bundle: Bundle, now: string, root: HTMLElement = qs("#app")): void {
  const view = createViewStore();
  const readout = cursorBalance();

  // The cheap path: the timeline hands us a cursor date; we read the cached
  // series and write the readout. No broadcast — a 60 Hz scrub stays off the
  // render path by construction.
  const tl = timeline({
    onScrub: (date) => {
      readout.setDate(date);
      readout.setBalance(coord.balanceAt(date));
    },
  });

  // The render path: re-lay the substrate, then rebuild the cards from the
  // selectors on the *same* axis the timeline drew (the shared seam, `tl.axis`)
  // and mount them. `layout` re-emits the cursor date through `onScrub`, so the
  // readout follows the fresh projection. The below-lane packer (4e) runs after
  // mount, once heights can be measured, and resolve overlaps without moving any
  // stem off-tick: below stacks vertically, above nudges groups horizontally.
  function refresh(): void {
    const projection = coord.projection();
    // The extent is the displayed card range — all known time, first arrival to
    // last — so every card fits the canvas. `layout` pads PAD_DAYS either side
    // (the prototype's fixed buffer) and centres on today on first load.
    tl.layout(displayExtent(bundle), now);
    const axis = tl.axis();
    if (!axis) return tl.setCards([]);
    const below = belowLaneCards(projection, bundle, axis);
    const above = aboveLaneGroups(bundle, axis);
    const belowEls = below.map(belowCard);
    const aboveEls = above.map(bannerGroup);
    tl.setCards([...belowEls, ...aboveEls]);
    // Mounted now → heights are measurable. Pack each lane (below returns its
    // floor depth, above its roof height); the timeline turns these into its
    // dynamic vertical roof/floor.
    const belowDepth = packBelowLane(below, belowEls);
    const aboveDepth = packAboveLane(above, aboveEls);
    tl.setContentDepth(aboveDepth, belowDepth);
  }
  coord.subscribe(refresh);

  // The Account overlay's body: the snapshot editor — the domain mutation source.
  function snapshotEditor(): HTMLElement {
    const carats = h("input", { class: "snapshot-carats", attr: { type: "number", min: 0, step: 100 } });
    const saved = coord.document().snapshot?.resources.free_carats;
    if (saved !== undefined) carats.value = String(saved);
    carats.addEventListener("change", () => {
      coord.update({ snapshot: { date: now, resources: { free_carats: carats.valueAsNumber || 0 } } });
    });
    return h("label", { class: "field" }, h("span", "Carats now"), carats);
  }

  // The view-state-driven layer: which overlay is open is a discrete change, so
  // it flows through `subscribe` and re-renders here (the render path).
  const overlayLayer = h("div", { class: "overlay-layer" });
  function renderOverlay(): void {
    if (view.get().overlay === "account") {
      overlayLayer.replaceChildren(
        overlay({ title: "Account", body: snapshotEditor(), onClose: () => view.set({ overlay: null }) }),
      );
    } else {
      overlayLayer.replaceChildren();
    }
  }
  view.subscribe(renderOverlay);

  const menubar = h(
    "nav",
    { class: "menubar" },
    h(
      "button",
      {
        class: "menubar__item",
        attr: { type: "button" },
        on: { click: () => view.set({ overlay: view.get().overlay === "account" ? null : "account" }) },
      },
      "Account",
    ),
  );

  root.replaceChildren(menubar, tl.el, readout.el, overlayLayer);
  refresh();
  renderOverlay();
}
