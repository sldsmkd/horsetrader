/**
 * The app shell: the one place that knows the wiring. It builds the view tree
 * once, drives the two-tier change model, and owns the transient cursor state.
 *
 * The smallest end-to-end slice of the one-way loop (docs/frontend/interaction.md,
 * build order step 3), now exercising **both broadcast stores**:
 *   - the **coordinator** (domain): editing the snapshot carats is a mutation →
 *     `update` → recompute → `subscribe` → `refresh` (the render path); a scrub
 *     is transient interaction-state written straight to the readout off
 *     `balanceAt`, with no broadcast and no rebuild (the cheap path);
 *   - the **view-state store** (discrete UI): the menubar toggles which overlay
 *     is open → `subscribe` → mount/unmount the overlay. The canvas (scrub +
 *     readout) stays live behind it (ui.md principle 1).
 *
 * The two stores are independent: editing carats inside the Account overlay
 * refreshes the canvas behind it (coordinator) while the overlay stays open
 * (view-state untouched). The cursor date is a plain closure variable here,
 * deliberately not in a store with `subscribe`, so a scrub cannot enter the
 * render path. No state is read back out of the DOM.
 */

import { h, qs } from "./h.ts";
import { cursorBalance } from "./views/cursorBalance.ts";
import { overlay } from "./views/overlay.ts";
import { createViewStore } from "./state/viewState.ts";
import { addDays } from "../core/projection/dates.ts";
import type { Coordinator } from "../core/coordinator/index.ts";

const MS_PER_DAY = 86_400_000;

/** Whole days from `from` to `to` (both ISO dates, UTC) — for sizing the scrub. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

export function mountApp(coord: Coordinator, now: string, root: HTMLElement = qs("#app")): void {
  const view = createViewStore();
  const readout = cursorBalance();
  const scrub = h("input", { class: "scrub", attr: { type: "range", min: 0 } });

  // Transient interaction-state — the cursor date. Owned here, never broadcast.
  let cursorDate = now;

  function showCursor(): void {
    readout.setDate(cursorDate);
    readout.setBalance(coord.balanceAt(cursorDate));
  }

  // The cheap path: a scrub maps the slider index to a date off the series extent
  // and writes the readout directly — no recompute, no broadcast, no rebuild.
  scrub.addEventListener("input", () => {
    const extent = coord.projection().series.extent;
    if (!extent) return;
    cursorDate = addDays(extent[0], scrub.valueAsNumber);
    showCursor();
  });

  // The render path: editing the snapshot is a domain mutation that recomputes
  // and notifies. `refresh` re-reads the new extent, re-bounds and re-aligns the
  // scrub, clamps the cursor, and refreshes the readout. Rare, so this is fine.
  function refresh(): void {
    const extent = coord.projection().series.extent;
    if (extent) {
      scrub.max = String(daysBetween(extent[0], extent[1]));
      if (cursorDate < extent[0]) cursorDate = extent[0];
      else if (cursorDate > extent[1]) cursorDate = extent[1];
      scrub.value = String(daysBetween(extent[0], cursorDate));
    }
    showCursor();
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

  const canvas = h(
    "section",
    { class: "panel" },
    h("label", { class: "field" }, h("span", "Cursor"), scrub),
    readout.el,
  );

  root.replaceChildren(menubar, canvas, overlayLayer);
  refresh();
  renderOverlay();
}
