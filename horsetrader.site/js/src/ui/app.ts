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
import { bannerCard } from "./views/bannerCard.ts";
import { overlay } from "./views/overlay.ts";
import { belowLaneCards } from "./select/belowLane.ts";
import { aboveLaneBanners } from "./select/aboveLane.ts";
import { packBelow } from "./pack/pack.ts";
import type { BelowCard } from "./select/belowLane.ts";
import { createViewStore } from "./state/viewState.ts";
import type { Coordinator } from "../core/coordinator/index.ts";
import type { Bundle } from "./bundle/access.ts";

/** Below-lane collision spacing (content px): horizontal breathing room between
 *  neighbours, and the vertical gap between stacked cards. Tune by eye. */
const BELOW_GAP_X = 10;
const BELOW_GAP_Y = 6;

/**
 * The packer's impure bookend: measure the just-mounted below cards once, run the
 * pure `packBelow` geometry, then apply each offset by **growing the stem** — so
 * the body drops to its packed row while the stem still reaches its true-date tick
 * (principle 4). The card width is uniform (CSS), so one measurement sets the
 * collision width; heights are per-card body heights. Shallower cards sit on top.
 */
function packBelowLane(cards: readonly BelowCard[], els: readonly HTMLElement[]): void {
  if (els.length === 0) return;
  const stems = els.map((el) => el.querySelector(".card__stem") as HTMLElement);
  const bodies = els.map((el) => el.querySelector(".card__body") as HTMLElement);
  const width = els[0].getBoundingClientRect().width;
  const baseStem = stems[0].getBoundingClientRect().height;
  const boxes = cards.map((card, i) => ({ x: card.x, height: bodies[i].getBoundingClientRect().height }));

  const offsets = packBelow(boxes, { width, gapX: BELOW_GAP_X, gapY: BELOW_GAP_Y });
  offsets.forEach((offset, i) => {
    stems[i].style.height = `${baseStem + offset}px`;
    els[i].style.zIndex = String(Math.round(1000 - offset)); // shallower rows in front
  });
}

/**
 * The displayed-card date range: earliest start to latest end across every event
 * in the horizon (`end > after`), or null when none. This is what the timeline
 * spans — "start of time to the end" — rather than the balance-series extent,
 * which only covers rewarded events and would clip the reward-less placeholders.
 */
function displayExtent(bundle: Bundle, after: string): readonly [string, string] | null {
  let lo: string | null = null;
  let hi: string | null = null;
  for (const ev of bundle.all()) {
    if (ev.end <= after) continue; // out of horizon — not shown
    if (lo === null || ev.start < lo) lo = ev.start;
    if (hi === null || ev.end > hi) hi = ev.end;
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
  // mount, once heights can be measured, and resolves overlaps without moving any
  // stem off-tick. Above-lane packing is still to come (placed naïvely for now).
  function refresh(): void {
    const projection = coord.projection();
    const after = coord.document().snapshot?.date ?? now;
    // The extent is the *displayed card* range — first card start to last card
    // end — so every card fits the canvas (the balance series omits reward-less
    // ones). `layout` pads PAD_DAYS either side (the prototype's fixed buffer).
    tl.layout(displayExtent(bundle, after), now);
    const axis = tl.axis();
    if (!axis) return tl.setCards([]);
    const below = belowLaneCards(projection, bundle, axis, after);
    const belowEls = below.map(belowCard);
    tl.setCards([
      ...belowEls,
      ...aboveLaneBanners(bundle, axis, after).map(bannerCard),
    ]);
    packBelowLane(below, belowEls); // mounted now → heights are measurable
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
