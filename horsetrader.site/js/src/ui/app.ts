/**
 * The app shell: the one place that knows the wiring. It builds the view tree
 * once and drives the two-tier change model (docs/frontend/interaction.md).
 *
 *   - **Cheap path:** the timeline owns the transient pan and pushes the
 *     view-centre date straight here via `onView`; we read `balanceAt` into the
 *     menubar and move the minimap window — no recompute, no broadcast, no rebuild.
 *   - **Render path:** a domain mutation (editing the snapshot in the Account
 *     overlay) recomputes and notifies; we re-lay the timeline for the new
 *     extent, which re-emits the centre date through `onView` and so refreshes
 *     the menubar against the fresh projection. Rare, so a full re-layout is fine.
 *   - **Discrete view-state:** the menubar toggles which overlay is open through
 *     the view-state store's `subscribe`; the timeline stays live behind it
 *     (ui.md principle 1, via the `pointer-events: none` overlay layer).
 *
 * As of 4b the standalone step-3 scrub `<input>` is gone: the timeline substrate
 * is the real owner of pan/focus. No state is read back out of the DOM. As of 4f
 * the focus is the view centre itself (no separate cursor) — `onView` drives both
 * the menubar and the minimap window.
 */

import "./app.css";

import { h, qs } from "./h.ts";
import { timeline } from "./views/timeline.ts";
import { minimap } from "./views/minimap.ts";
import { belowCard } from "./views/belowCard.ts";
import { bannerGroup } from "./views/bannerGroup.ts";
import { overlay } from "./views/overlay.ts";
import { menubar } from "./views/menubar.ts";
import type { MenubarOverlay } from "./views/menubar.ts";
import { playStyleSurface } from "./views/playStyleSurface.ts";
import type { PlayStyleKey } from "./views/playStylePreset.ts";
import { createIdentityController } from "./identity/controller.ts";
import {
  PLAY_STYLE_MACHINE_INITIAL,
  previewedPlayStyle,
  reducePlayStyleMachine,
} from "./identity/playStyleMachine.ts";
import type { IdentityOverlayState, PlayStyleMachineEvent } from "./identity/playStyleMachine.ts";
import { playStyleSettingsForPreset } from "./identity/playStyleSettings.ts";
import type { PlayStyleSettings } from "./identity/playStyleSettings.ts";
import type { UiStrings } from "./strings.ts";
import { belowLaneCards } from "./select/belowLane.ts";
import { aboveLaneGroups } from "./select/aboveLane.ts";
import { createSearchIndex } from "./search/index.ts";
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

type AppOverlay = MenubarOverlay | "oshi" | "playstyle" | "playstyle-oshi";

function appOverlayForIdentityOverlay(overlay: IdentityOverlayState): AppOverlay {
  if (overlay === "closed") return null;
  if (overlay === "trainer") return "identity";
  return overlay;
}

function suspendOverlay(card: HTMLElement): HTMLElement {
  card.classList.add("overlay--suspended");
  card.setAttribute("aria-hidden", "true");
  card.append(h("div", { class: "overlay__modal-shield", attr: { "aria-hidden": "true" } }));
  return card;
}

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
  const stem = (els[0].querySelector(".card__stem") as HTMLElement).getBoundingClientRect().height;
  const boxes = groups.map((group, i) => ({ x: group.x, width: bodies[i].getBoundingClientRect().width }));

  const nudges = packAbove(boxes, ABOVE_GAP);
  let roof = 0;
  nudges.forEach((nudge, i) => {
    bodies[i].style.transform = nudge ? `translateX(${nudge}px)` : "";
    // The lane reaches stem + body above the line — same stem+body measure the
    // below bookend uses for its floor, so the two peek bounds stay symmetric.
    roof = Math.max(roof, stem + bodies[i].getBoundingClientRect().height);
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

export function mountApp(
  coord: Coordinator,
  bundle: Bundle,
  now: string,
  strings: UiStrings,
  root: HTMLElement = qs("#app"),
): void {
  const view = createViewStore();
  const search = createSearchIndex(bundle, now);
  const identity = createIdentityController(coord, bundle, strings);
  let identityUi = PLAY_STYLE_MACHINE_INITIAL;
  let stagedPlayStyleSettings: PlayStyleSettings | null = null;
  const sendIdentityEvent = (event: PlayStyleMachineEvent): void => {
    identityUi = reducePlayStyleMachine(identityUi, event, identity.savedPlayStyleKey());
    if (
      event.type === "toggle-identity" ||
      event.type === "discard-playstyle" ||
      event.type === "commit-playstyle" ||
      event.type === "close-all"
    ) {
      stagedPlayStyleSettings = null;
    } else if (event.type === "preview-playstyle") {
      const savedPlayStyleKey = identity.savedPlayStyleKey();
      const playStyleKey = previewedPlayStyle(identityUi, savedPlayStyleKey);
      stagedPlayStyleSettings =
        identityUi.overlay === "playstyle" || identityUi.overlay === "playstyle-oshi"
          ? playStyleKey === savedPlayStyleKey
            ? null
            : playStyleSettingsForPreset(playStyleKey)
          : null;
    }
    view.set({ overlay: appOverlayForIdentityOverlay(identityUi.overlay) });
  };
  const toggleOverlay = (overlay: Exclude<MenubarOverlay, null>) => {
    identityUi = PLAY_STYLE_MACHINE_INITIAL;
    stagedPlayStyleSettings = null;
    view.set({ overlay: view.get().overlay === overlay ? null : overlay });
  };

  // The minimap is the primary navigation: dragging its track seeks, which pans
  // the timeline (`centerOn`); the timeline pushes its view-centre date back so
  // the window tracks the pan — a two-way cheap-path binding, no broadcast.
  const mini = minimap({ onSeek: (date) => tl.centerOn(date) });

  // The cheap path: the view centre *is* the focus. The timeline hands us the
  // centre date on every pan; we read the cached series into the menubar and move
  // the minimap window. No broadcast — a 60 Hz pan stays off the render path.
  const tl = timeline({
    onView: (date) => {
      const balance = coord.balanceAt(date);
      menu.setDate(date);
      menu.setBalance(balance.free_carats ?? 0);
      mini.setView(date);
    },
  });

  const menu = menubar({
    initialDate: now,
    initialBalance: coord.balanceAt(now).free_carats ?? 0,
    identity: identity.menuIdentity(),
    openOverlay: null,
    onHome: () => tl.warpTo(now),
    onIdentity: () => sendIdentityEvent({ type: "toggle-identity" }),
    onPlan: () => toggleOverlay("plan"),
    onResources: () => toggleOverlay("resources"),
    onTazuna: () => toggleOverlay("tazuna"),
    search,
    onSearch: (result) => {
      view.set({ search: result.label, selection: result.id });
      tl.warpTo(result.date);
    },
  });

  // The render path: re-lay the substrate, then rebuild the cards from the
  // selectors on the *same* axis the timeline drew (the shared seam, `tl.axis`)
  // and mount them. `layout` re-emits the centre date through `onView`, so the
  // menubar follows the fresh projection. The below-lane packer (4e) runs after
  // mount, once heights can be measured, and resolve overlaps without moving any
  // stem off-tick: below stacks vertically, above nudges groups horizontally.
  function refresh(): void {
    const projection = coord.projection();
    const extent = displayExtent(bundle);
    // The minimap is another view over the same projection. Repaint it *before*
    // the timeline lays out: `tl.layout` emits the initial view-centre date
    // through `onView → mini.setView`, which needs the minimap's axis already
    // built (otherwise the first window placement is dropped).
    mini.refresh({ series: projection.series, bundle, favourites: coord.document().favourites ?? {}, extent, now });
    // The extent is the displayed card range — all known time, first arrival to
    // last — so every card fits the canvas. `layout` pads PAD_DAYS either side
    // (the prototype's fixed buffer) and centres on today on first load.
    tl.layout(extent, now);
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

  // Viewport resize is a render-path event: the minimap axis/viewBox, the pan
  // bounds and the centred markers are all measured off clientWidth/Height, so a
  // resize must re-lay everything. rAF-coalesced so a drag-resize runs at most
  // once per frame rather than per resize tick.
  let resizePending = 0;
  window.addEventListener("resize", () => {
    if (resizePending) return;
    resizePending = requestAnimationFrame(() => {
      resizePending = 0;
      refresh();
    });
  });

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
  const closeOshiSelector = () => sendIdentityEvent({ type: "close-oshi" });
  const previewPlayStyle = (key: PlayStyleKey): void => sendIdentityEvent({ type: "preview-playstyle", key });
  const discardPlayStylePreview = (): void => {
    sendIdentityEvent({ type: "discard-playstyle" });
  };
  const commitPlayStylePreview = (key: PlayStyleKey, settings: PlayStyleSettings): void => {
    identity.commitPlayStyle(key, settings);
    sendIdentityEvent({ type: "commit-playstyle" });
  };

  function renderOverlay(): void {
    const open = view.get().overlay as AppOverlay;
    menu.setIdentity(identity.menuIdentity());
    menu.setOpenOverlay(open === "oshi" || open === "playstyle" || open === "playstyle-oshi" ? "identity" : open);
    const trainerCard = (opts: { suspended?: boolean; previewPlayStyleKey?: PlayStyleKey } = {}): HTMLElement =>
      identity.trainerCardOverlay({
        ...opts,
        onOshiSelect: () => sendIdentityEvent({ type: "open-oshi" }),
        onPlayStylePreview: previewPlayStyle,
        onClose: () => sendIdentityEvent({ type: "close-all" }),
      });
    const playStyleBook = (opts: { suspended?: boolean } = {}): HTMLElement => {
      const savedPlayStyleKey = identity.savedPlayStyleKey();
      const savedPlayStyleSettings = identity.savedPlayStyleSettings();
      const playStyleKey = previewedPlayStyle(identityUi, savedPlayStyleKey);
      const playStyleSettings =
        stagedPlayStyleSettings ??
        (playStyleKey === savedPlayStyleKey ? savedPlayStyleSettings : playStyleSettingsForPreset(playStyleKey));
      const playStyleCard = overlay({
        title: strings.playStyle.title,
        body: playStyleSurface({
          playStyleKey,
          savedPlayStyleKey,
          settings: playStyleSettings,
          savedSettings: savedPlayStyleSettings,
          strings: strings.playStyle,
          onSettingsChange: (settings) => {
            stagedPlayStyleSettings = settings;
            renderOverlay();
          },
          onApply: commitPlayStylePreview,
        }),
        onClose: discardPlayStylePreview,
      });
      return h(
        "div",
        { class: "overlay-book" },
        trainerCard({
          previewPlayStyleKey: playStyleKey,
          ...(opts.suspended ? { suspended: true } : {}),
        }),
        opts.suspended ? suspendOverlay(playStyleCard) : playStyleCard,
      );
    };
    if (open === "resources") {
      overlayLayer.replaceChildren(
        overlay({ title: "Resources", body: snapshotEditor(), onClose: () => view.set({ overlay: null }) }),
      );
    } else if (open === "identity") {
      overlayLayer.replaceChildren(trainerCard());
    } else if (open === "oshi") {
      overlayLayer.replaceChildren(
        trainerCard({ suspended: true }),
        identity.oshiSelectorOverlay({ onClose: closeOshiSelector }),
      );
    } else if (open === "playstyle") {
      overlayLayer.replaceChildren(
        playStyleBook(),
      );
    } else if (open === "playstyle-oshi") {
      overlayLayer.replaceChildren(
        playStyleBook({ suspended: true }),
        identity.oshiSelectorOverlay({ onClose: closeOshiSelector }),
      );
    } else if (open === "plan") {
      overlayLayer.replaceChildren(
        overlay({ title: "Plan", body: h("p", "No commitments yet."), onClose: () => view.set({ overlay: null }) }),
      );
    } else if (open === "tazuna") {
      overlayLayer.replaceChildren(
        overlay({
          title: "Tazuna",
          body: h("p", "Help and explanations will live here."),
          onClose: () => view.set({ overlay: null }),
        }),
      );
    } else {
      overlayLayer.replaceChildren();
    }
  }
  view.subscribe(renderOverlay);
  coord.subscribe(renderOverlay);

  root.replaceChildren(menu.el, tl.el, mini.el, overlayLayer);
  refresh();
  renderOverlay();
}
