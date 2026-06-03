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
import { overlay } from "./views/overlay.ts";
import { createViewStore } from "./state/viewState.ts";
import type { Coordinator } from "../core/coordinator/index.ts";

export function mountApp(coord: Coordinator, now: string, root: HTMLElement = qs("#app")): void {
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

  // The render path: re-lay the timeline for the new extent. `layout` re-emits
  // the cursor date through `onScrub`, so the readout follows the fresh projection.
  function refresh(): void {
    tl.layout(coord.projection().series.extent, now);
  }
  coord.subscribe(refresh);

  // The Account overlay's body: the snapshot editor — the domain mutation source.
  function snapshotEditor(): HTMLElement {
    const carats = h("input", { class: "snapshot-carats", attr: { type: "number", min: 0, step: 100 } });
    const saved = coord.document().snapshot?.resources.carats_free;
    if (saved !== undefined) carats.value = String(saved);
    carats.addEventListener("change", () => {
      coord.update({ snapshot: { date: now, resources: { carats_free: carats.valueAsNumber || 0 } } });
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
