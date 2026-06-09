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
import type { RushBinding } from "./widgets/rushedToggle.ts";
import type { FavouriteBinding } from "./widgets/atomChip.ts";
import { overlay, suspendOverlay } from "./views/overlay.ts";
import { resourcesSurface } from "./views/resourcesSurface.ts";
import type { ResourcesSurfaceHandle } from "./views/resourcesSurface.ts";
import { resourcesEditor } from "./views/resourcesEditor.ts";
import { tazunaSurface } from "./views/tazunaSurface.ts";
import { bookmarks } from "./views/bookmarks.ts";
import { bookmarkRows } from "./select/bookmarks.ts";
import { buildTrainerCard, buildOshiSelectorOverlay, buildPlayStyleOverlay } from "./views/identityOverlay.ts";
import { menubar } from "./views/menubar.ts";
import type { RightSurface } from "./views/menubar.ts";
import type { PlayStyleKey } from "./views/playStylePreset.ts";
import { createIdentityController } from "./identity/controller.ts";
import {
  PLAY_STYLE_MACHINE_INITIAL,
  reducePlayStyleMachine,
} from "./identity/playStyleMachine.ts";
import type { PlayStyleMachineEvent, PlayStyleMachineState } from "./identity/playStyleMachine.ts";
import type { PlayStyleSettings } from "./identity/playStyleSettings.ts";
import type { UiStrings } from "./strings.ts";
import { belowLaneCards } from "./select/belowLane.ts";
import { aboveLaneGroups } from "./select/aboveLane.ts";
import { createSearchIndex } from "./query/index.ts";
import { packBelow, packAbove } from "./pack/pack.ts";
import type { BelowCard } from "./select/belowLane.ts";
import type { BannerGroup } from "./select/aboveLane.ts";
import { createViewStore } from "./state/viewState.ts";
import { createMachine } from "./state/machine.ts";
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
  const identity = createIdentityController(coord, bundle);
  const identityMachine = createMachine<PlayStyleMachineState, PlayStyleMachineEvent>(
    (state, event) => reducePlayStyleMachine(state, event, identity.savedPlayStyleKey()),
    PLAY_STYLE_MACHINE_INITIAL,
  );
  // The machine IS the left group's state; its `send` notifies subscribers, so
  // renderOverlay (subscribed below) re-runs. No mirror into view-state.
  const sendIdentityEvent = (event: PlayStyleMachineEvent): void => identityMachine.send(event);
  // The right surface group: opening a member replaces whatever right surface was
  // open (so only one per group), and clears the resources editor child. It does
  // NOT touch the left group — left and right are independent.
  const toggleRight = (member: RightSurface): void => {
    const current = view.get().right;
    view.set({ right: current === member ? null : member, resourcesEditing: false });
  };

  // The minimap is the primary navigation: dragging its track seeks, which pans
  // the timeline (`centerOn`); the timeline pushes its view-centre date back so
  // the window tracks the pan — a two-way cheap-path binding, no broadcast.
  const mini = minimap({ onSeek: (date) => tl.centerOn(date) });

  // Track the current view-centre date for the Resources projected block. Updated
  // on the cheap path (every pan) so Resources always shows the right projection.
  let viewDate = now;

  // The open Resources card, when one is up — a live handle the pan path refreshes
  // imperatively (like the menubar), since `onView` deliberately skips the overlay
  // rebuild. Null whenever the card isn't mounted; set/cleared in renderOverlay.
  let liveResources: ResourcesSurfaceHandle | null = null;

  // The cheap path: the view centre *is* the focus. The timeline hands us the
  // centre date on every pan; we read the cached series into the menubar and move
  // the minimap window. No broadcast — a 60 Hz pan stays off the render path.
  const tl = timeline({
    onView: (date) => {
      viewDate = date;
      const balance = coord.balanceAt(date);
      menu.setDate(date);
      menu.setResources(balance);
      mini.setView(date);
      liveResources?.update({ viewDate: date, projected: balance });
    },
  });

  // The bookmarks drawer: layer-2 chrome, twin of the minimap dots over the same
  // favourites map. Its open/collapsed state is independent view-state (it coexists
  // with overlays, not modal); each row warps the timeline like Home/search do.
  const book = bookmarks({
    onToggle: () => view.set({ bookmarks: !view.get().bookmarks }),
    onWarp: (date) => tl.warpTo(date),
  });

  const menu = menubar({
    initialDate: now,
    initialResources: coord.balanceAt(now),
    identity: identity.menuIdentity(),
    onHome: () => tl.warpTo(now),
    onIdentity: () => sendIdentityEvent({ type: "toggle-identity" }),
    onPlan: () => {}, // inert until the planner surface lands
    onResources: () => toggleRight("resources"),
    onTazuna: () => toggleRight("tazuna"),
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
  // Rushed state is persisted user input (the `rushed` map: event key → the UTC
  // instant it was rushed). The binding reads/writes the live document so it never
  // goes stale; setting writes the timestamp, unsetting deletes the key. `update`
  // recomputes + notifies → `refresh` rebuilds the cards with the new pressed
  // state. Storing raw UTC: it's an action-timestamp, not a timeline date. (Fully
  // clearing leaves a `{}` rather than omitting the key — `update`'s spread merge
  // can't delete a section; reads `?? {}` so it's behaviourally identical.)
  const rush: RushBinding = {
    isRushed: (key) => key in (coord.document().rushed ?? {}),
    setRushed: (key, on) => {
      const next = { ...(coord.document().rushed ?? {}) };
      if (on) next[key] = new Date().toISOString();
      else delete next[key];
      coord.update({ rushed: next });
    },
  };

  const fav: FavouriteBinding = {
    isFavourited: (id) => id in (coord.document().favourites ?? {}),
    setFavourited: (id, on) => {
      const next = { ...(coord.document().favourites ?? {}) };
      if (on) next[id] = {};
      else delete next[id];
      coord.update({ favourites: next });
    },
  };

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
    const below = belowLaneCards(projection, bundle, axis, now);
    const above = aboveLaneGroups(bundle, axis, now);
    const belowEls = below.map((card) => belowCard(card, rush));
    const aboveEls = above.map((group) => bannerGroup(group, rush, fav));
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

  // Supporter status gates the custom play-style preset. Resolved once at init
  // (hash + fetch of the published list) — deliberately not re-checked at
  // runtime; an ID/name edit takes effect on next load.
  let supporterUnlocked = false;
  void identity.isSupporter().then((unlocked) => {
    supporterUnlocked = unlocked;
    if (unlocked) renderOverlay();
  });

  // Live read of "is a shield (modal child window) up?" — the fallback guard for
  // every spawn control. Suspension already makes the controls unreachable; this
  // belt-and-braces refuses the spawn even if one slips through. A shield is modal
  // to ALL spawnable windows (feedback_shield_vs_unfold).
  const shieldOpen = (): boolean => {
    const left = identityMachine.get().overlay;
    return left === "oshi" || left === "playstyle-oshi" || view.get().resourcesEditing;
  };

  function renderOverlay(): void {
    const identityUi = identityMachine.get();
    const left = identityUi.overlay; // left group — the machine is its sole owner
    const right = view.get().right as RightSurface | null; // right group
    // A shield (oshi or balance editor) is modal to ALL spawnable windows: it
    // locks the menu's surface spawners AND suspends every other open surface so
    // their in-card pencils can't spawn a second shield. One predicate, reused.
    const anyShield = shieldOpen();

    menu.setIdentity(identity.menuIdentity());
    menu.setLeftActive(left !== "closed");
    menu.setRightActive(right);
    menu.setShielded(anyShield);

    const trainerCardOn = {
      onOshiSelect: () => {
        if (!shieldOpen()) sendIdentityEvent({ type: "open-oshi" });
      },
      onPlayStylePreview: previewPlayStyle,
      onClose: () => sendIdentityEvent({ type: "close-all" }),
    };
    const playStyleOn = {
      ...trainerCardOn,
      onTrainerClose: () => sendIdentityEvent({ type: "close-all" }),
      onDiscard: discardPlayStylePreview,
      onSettingsChange: (settings: PlayStyleSettings) => sendIdentityEvent({ type: "stage-settings", settings }),
      onApply: commitPlayStylePreview,
    };

    const children: Node[] = [];
    // Rebuilt below if the Resources card is in this frame; the pan path checks it.
    liveResources = null;

    if (left === "identity") {
      children.push(buildTrainerCard(identity, strings, { suspended: anyShield, customUnlocked: supporterUnlocked }, trainerCardOn));
    } else if (left === "oshi") {
      children.push(
        buildTrainerCard(identity, strings, { suspended: true, customUnlocked: supporterUnlocked }, trainerCardOn),
        buildOshiSelectorOverlay(identity, { onClose: closeOshiSelector }),
      );
    } else if (left === "playstyle") {
      children.push(buildPlayStyleOverlay(identity, strings, identityUi, { suspended: anyShield, customUnlocked: supporterUnlocked }, playStyleOn));
    } else if (left === "playstyle-oshi") {
      children.push(
        buildPlayStyleOverlay(identity, strings, identityUi, { suspended: true, customUnlocked: supporterUnlocked }, playStyleOn),
        buildOshiSelectorOverlay(identity, { onClose: closeOshiSelector }),
      );
    }

    // The right group: one surface (+ its children) at a time, independent of the
    // left group above.
    if (right === "resources") {
      const editing = view.get().resourcesEditing;
      const resources = resourcesSurface({
        viewDate,
        projected: coord.balanceAt(viewDate),
        snapshot: coord.document().snapshot,
        now,
        onEdit: () => {
          if (!shieldOpen()) view.set({ resourcesEditing: true });
        },
      });
      liveResources = resources; // the pan path refreshes this card in place
      const resourcesCard = overlay({
        title: "Resources",
        placement: "right",
        body: resources.el,
        // Closing the surface tears the editor shield down with it.
        onClose: () => view.set({ right: null, resourcesEditing: false }),
      });
      // The editor is a shield over the surface (the oshi/trainer pattern); any
      // shield up suspends this surface too, so its pencil can't spawn a second.
      if (anyShield) suspendOverlay(resourcesCard);
      children.push(resourcesCard);

      if (editing) {
        children.push(
          overlay({
            title: "Edit Balance",
            placement: "center",
            body: resourcesEditor({
              snapshot: coord.document().snapshot,
              onCommit: (snapshot) => coord.update({ snapshot }),
              onClose: () => view.set({ resourcesEditing: false }),
            }),
            onClose: () => view.set({ resourcesEditing: false }),
          }),
        );
      }
    } else if (right === "tazuna") {
      const tazunaCard = overlay({
        title: "Tazuna",
        placement: "right",
        body: tazunaSurface(),
        onClose: () => view.set({ right: null }),
      });
      if (anyShield) suspendOverlay(tazunaCard);
      children.push(tazunaCard);
    }

    overlayLayer.replaceChildren(...children);
  }
  view.subscribe(renderOverlay);
  coord.subscribe(renderOverlay);
  identityMachine.subscribe(renderOverlay); // left group re-renders on its own events

  // The drawer is a view over favourites (coord) and its open flag (view-state),
  // so it re-renders on both paths — the same dual-subscribe as the overlay layer.
  function renderBookmarks(): void {
    book.refresh({
      rows: bookmarkRows(bundle, coord.document().favourites ?? {}, now),
      open: view.get().bookmarks,
    });
  }
  view.subscribe(renderBookmarks);
  coord.subscribe(renderBookmarks);

  // Mount order is the z-band: timeline (back), the bookmarks drawer, then the
  // overlay layer (paints over the drawer where they share the top-left zone), with
  // the menubar/minimap lifted above all of it (their own z-index) so the always-
  // reachable chrome is never occluded.
  root.replaceChildren(menu.el, tl.el, book.el, mini.el, overlayLayer);
  refresh();
  renderOverlay();
  renderBookmarks();
}
