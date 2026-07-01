/**
 * The app shell: the one place that knows the wiring. It builds the view tree
 * once and drives the two-tier change model (docs/frontend/interaction.md).
 *
 *   - **Cheap path:** the timeline owns the transient pan and pushes the
 *     view-centre date straight here via `onView`; we read `balanceAt` into the
 *     menubar and move the minimap window — no recompute, no broadcast, no rebuild.
 *   - **Render path:** a domain mutation (editing the snapshot in the Account
 *     surface) recomputes and notifies; we re-lay the timeline for the new
 *     extent, which re-emits the centre date through `onView` and so refreshes
 *     the menubar against the fresh projection. Rare, so a full re-layout is fine.
 *   - **Discrete view-state:** the menubar toggles which surface is open through
 *     the view-state store's `subscribe`; the timeline stays live behind it
 *     (ui.md principle 1, via the `pointer-events: none` surface layer).
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
import { filmstrip } from "./views/filmstrip.ts";
import { filmFrames } from "./select/filmstrip.ts";
import { scenarioArt } from "./views/scenarioArt.ts";
import { perfHud } from "./views/perfHud.ts";
import { runOnboarding } from "./views/onboarding/onboarding.ts";
import type { OnboardingHandle } from "./views/onboarding/onboarding.ts";
import { perfInstrument } from "./perf.ts";
import type { BakeStats } from "../core/bundle/stats.gen.ts";
import { belowCard } from "./views/belowCard.ts";
import { bannerGroup } from "./views/bannerGroup.ts";
import type { RushBinding } from "./views/widgets/rushedToggle.ts";
import type { FavouriteBinding, InspectBinding } from "./views/widgets/atomChip.ts";
import { surface, lockSurface, escDismissTarget } from "./views/surfaces/surface.ts";
import { resourcesSurface } from "./views/surfaces/resourcesSurface.ts";
import type { ResourcesSurfaceHandle } from "./views/surfaces/resourcesSurface.ts";
import { resourcesEditor } from "./views/surfaces/resourcesEditor.ts";
import { commitDossier, commitTitle } from "./views/surfaces/commitDossier.ts";
import { planSurface } from "./views/surfaces/planSurface.ts";
import { planRows } from "./select/plan.ts";
import { commitContext } from "./select/commit.ts";
import { cardSurface } from "./views/surfaces/cardSurface.ts";
import type { CommitBinding } from "./views/bannerGroup.ts";
import { betaSurface } from "./views/surfaces/betaSurface.ts";
import { presentConfirm } from "./views/surfaces/confirm.ts";
import { createUmaMark } from "./umamark/umamark.ts";
import { reconcileOnLoad, fetchAuth, syncNow, isSupporter, onSupporterChange } from "../core/cloud/index.ts";
import type { AuthState, SyncResult } from "../core/cloud/index.ts";
import { presentCloudConflict } from "./views/surfaces/cloudConflict.ts";
import { cloudProvider } from "./views/surfaces/cloudProvider.ts";
import { cloudControls } from "./views/widgets/cloudControls.ts";
import { pityBand } from "./views/widgets/pityBand.ts";
import type { PityBand } from "./views/widgets/pityBand.ts";
import { scenarioLookup } from "./select/scenario.ts";
import { buildOshiSelector, buildClubSelector } from "./views/surfaces/identityCards.ts";
import { trainerPage } from "./views/trainer/index.ts";
import { menubar } from "./views/menubar.ts";
import { BELOW_LANE_STACK_TOP, timelineLengthGolshis } from "./views/timeline/constants.ts";
import type { RightSurface } from "./views/menubar.ts";
import { createIdentityController } from "./identity/controller.ts";
import { createCapabilities, glassPointer } from "./caps/capabilities.ts";
import { trainerPresentation } from "./caps/trainerPresentation.ts";

import type { UiStrings } from "./strings.ts";
import { belowLaneCards } from "./select/belowLane.ts";
import { aboveLaneGroups, PITY_WASTE_ABOVE } from "./select/aboveLane.ts";
import { createSearchIndex } from "./query/index.ts";
import { packBelow, packAbove } from "./pack/pack.ts";
import type { BelowCard } from "./select/belowLane.ts";
import type { BannerGroup } from "./select/aboveLane.ts";
import { createViewStore } from "./state/viewState.ts";
import type { Coordinator, SettledEvent } from "../core/engine/index.ts";
import { daysBetween, type CalendarDate } from "../core/projection/dates.ts";
import type { Bundle } from "./bundle/access.ts";

function timelinePxVar(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) ? px : fallback;
}

/**
 * The packer's impure bookend: measure the just-mounted below cards once, run the
 * pure `packBelow` geometry, then apply each offset by **growing the stem** — so
 * the body drops to its packed row while the stem still reaches its true-date tick
 * (principle 4). Each card's collision width is measured and snapped to the unit
 * grid (1u = 140px; compact = 1u, full = 2u), so a slim card only fights for the
 * room it occupies; heights are per-card body heights. Shallower cards sit on top.
 * Returns how far the deepest card reaches below the line (px) — the lane's floor.
 */
function packBelowLane(cards: readonly BelowCard[], els: readonly HTMLElement[]): number {
  if (els.length === 0) return 0;
  const stems = els.map((el) => el.querySelector(".card__stem") as HTMLElement);
  const bodies = els.map((el) => el.querySelector(".card__body") as HTMLElement);
  // Camera-measurement invariant C-B6 (grand-masters/contracts.md, guarded by
  // cameraMeasure.test.ts): measure with offsetWidth/offsetHeight, NOT getBoundingClientRect.
  // The packer's boxes live in the unscaled content-axis space (card.x), but
  // getBoundingClientRect returns the camera-transformed (`scale(z)`) rect. The timeline
  // forces scale to 1 for the measurement window, but iOS Safari doesn't reliably reflect
  // that synchronous transform write in the immediately-following rect read, so on a
  // zoomed-out portrait viewport the packer read z-scaled widths and under-spaced the cards
  // (provenance: Godolphin F10). offset* are layout dimensions, independent of transforms —
  // correct regardless of whether the unscale flushed, and identical at z=1.
  const baseStem = stems[0].offsetHeight;
  const heights = bodies.map((b) => b.offsetHeight);
  // Snap each measured width to the nearest unit (1u = 140px, half the full card)
  // so the collision grid stays on clean 1u/2u/3u multiples, never a sub-pixel
  // rem-rounding sliver. The grid emerged from the real card styling.
  const unit = timelinePxVar("--timeline-card-w", 280) / 2;
  const widths = els.map((el) => Math.round(el.offsetWidth / unit) * unit);
  const boxes = cards.map((card, i) => ({ x: card.x, width: widths[i], height: heights[i] }));
  const gapX = timelinePxVar("--timeline-below-gap-x", 10);
  const gapY = timelinePxVar("--timeline-stack-gap", 14);

  const offsets = packBelow(boxes, { gapX, gapY });
  let depth = 0;
  offsets.forEach((offset, i) => {
    stems[i].style.height = `${baseStem + offset}px`;
    els[i].style.zIndex = String(Math.round(BELOW_LANE_STACK_TOP - offset)); // shallower rows in front
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
  // offsetWidth/offsetHeight, not getBoundingClientRect — transform-independent layout
  // geometry, so a zoomed-out portrait camera can't make the packer mis-measure on iOS
  // Safari (see packBelowLane for the full rationale; Godolphin F10).
  const stem = (els[0].querySelector(".card__stem") as HTMLElement).offsetHeight;
  const boxes = groups.map((group, i) => ({ x: group.x, width: bodies[i].offsetWidth }));
  const gap = timelinePxVar("--timeline-above-gap-x", 8);

  const nudges = packAbove(boxes, gap);
  let roof = 0;
  nudges.forEach((nudge, i) => {
    bodies[i].style.transform = nudge ? `translateX(${nudge}px)` : "";
    // The lane reaches stem + body above the line — same stem+body measure the
    // below bookend uses for its floor, so the two peek bounds stay symmetric.
    roof = Math.max(roof, stem + bodies[i].offsetHeight);
  });
  return roof;
}

/**
 * The displayed-card date range: earliest to latest arrival across the settled
 * world's lane events, or null when none. The timeline spans all known time —
 * start of history to the last scheduled event — not the balance-series/
 * projection horizon (you scroll back into the past too). Cards anchor at
 * `start`, so both ends measure `start`: the latest *end* would trail dead time
 * past the final card.
 */
function displayExtent(world: readonly SettledEvent[]): readonly [CalendarDate, CalendarDate] | null {
  let lo: CalendarDate | null = null;
  let hi: CalendarDate | null = null;
  for (const ev of world) {
    if (!ev.visible) continue; // ledger-only cadence never widens the canvas
    if (lo === null || ev.start < lo) lo = ev.start;
    if (hi === null || ev.start > hi) hi = ev.start;
  }
  return lo === null ? null : [lo, hi as CalendarDate];
}

export function mountApp(
  coord: Coordinator,
  bundle: Bundle,
  now: CalendarDate,
  strings: UiStrings,
  bakeStats: BakeStats,
  root: HTMLElement = qs("#app"),
): void {
  const view = createViewStore();
  // The Beta chamber (it hosts UmaMark's launcher — grand-masters/umamark.md) is now gated
  // on the supporter entitlement, watched off every cloud pull. Its menubar entry is driven
  // by `menu.setBetaAvailable` below; no construction-time flag.
  const search = createSearchIndex(bundle, now);
  const identity = createIdentityController(coord, bundle);
  const capabilities = createCapabilities();
  const applyGlassPointer = (): void => {
    document.documentElement.dataset.glassPointer = glassPointer(capabilities.get());
  };
  applyGlassPointer();
  capabilities.subscribe(applyGlassPointer);
  // The right surface group: opening a member replaces whatever right surface was
  // open (so only one per group), and clears the resources editor child. It does
  // NOT touch the left group — left and right are independent.
  const toggleRight = (member: RightSurface): void => {
    const current = view.get().right;
    view.set({ right: current === member ? null : member, resourcesEditing: false });
  };
  let cardStats = { cards: 0, aboveCards: 0, belowCards: 0, timelineGolshis: 0 };
  // Darley's perf instrument owns the measurement loop + churn collection + frame budget;
  // the HUD is a dumb view over its snapshots.
  const perf = perfInstrument({ drainChurn: () => tl.drainChurn() });
  const hud = perfHud({
    perf,
    bake: bakeStats,
    stats: () => ({
      ...cardStats,
      ...tl.visibility(),
      domNodes: root.getElementsByTagName("*").length,
    }),
  });

  // The minimap is the primary navigation: dragging its track seeks, which pans
  // the timeline (`centerOn`); the timeline pushes its view-centre date and
  // vertical well offset back so the window tracks the pan — a two-way cheap-path
  // binding, no broadcast.
  const mini = minimap({ onSeek: (date) => tl.centerOn(date) });
  // The film strip: the favourites face, an ordinal twin of the minimap squares.
  // It follows the view on the cheap path; clicking a face warps to that banner.
  const strip = filmstrip({ onWarp: (date) => tl.warpTo(date) });
  const scen = scenarioArt();
  const scenarioAt = scenarioLookup(bundle);

  // Track the current view-centre date for the Resources projected block. Updated
  // on the cheap path (every pan) so Resources always shows the right projection.
  let viewDate = now;

  // The open Resources card, when one is up — a live handle the pan path refreshes
  // imperatively (like the menubar), since `onView` deliberately skips the surface
  // rebuild. Null whenever the card isn't mounted; set/cleared in renderSurfaces.
  let liveResources: ResourcesSurfaceHandle | null = null;

  // The cheap path: the view centre *is* the focus. The timeline hands us the
  // centre date on every pan; we read the cached series into the menubar and move
  // the minimap window, including its vertical well offset. No broadcast — a
  // 60 Hz pan stays off the render path.
  const tl = timeline({
    onView: (date, verticalOffset) => {
      viewDate = date;
      const balance = coord.balanceAt(date);
      menu.setDate(date);
      menu.setResources(balance);
      mini.setView(date, verticalOffset);
      strip.setView(date);
      scen.setScenario(scenarioAt(date));
      liveResources?.update({ viewDate: date, projected: balance });
    },
  });

  const fav: FavouriteBinding = {
    isFavourited: (id) => id in (coord.document().favourites ?? {}),
    setFavourited: (id, on) => coord.setFavourite(id, on),
  };

  const menu = menubar({
    initialDate: now,
    initialResources: coord.balanceAt(now),
    identity: identity.menuIdentity(),
    onHome: () => tl.warpTo(now),
    onIdentity: () => {
      if (modalOpen()) return;
      view.set({
        trainer: !view.get().trainer,
        trainerChild: null,
        right: null,
        resourcesEditing: false,
      });
    },
    onResources: () => toggleRight("resources"),
    onPlan: () => {
      if (!modalOpen()) view.set({ plan: true });
    },
    onBeta: () => toggleRight("beta"),
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
  // instant it was rushed). The binding reads the live document so it never goes
  // stale and writes through the typed mutator, which recomputes + notifies →
  // `refresh` rebuilds the cards with the new pressed state.
  const rush: RushBinding = {
    isRushed: (key) => key in (coord.document().rushed ?? {}),
    setRushed: (key, on) => coord.setRushed(key, on),
  };

  // The expensive tail of the render path: materialise every card across the extent, mount,
  // pack (which measures heights → reflow), and arm the cull. This is the lone ~0.5s long task
  // (12-billion-yen-incident). Split out from `refresh` so the cheap chrome (minimap/strip/axis)
  // can paint first and this can be deferred a frame on the very first mount — see `refresh`.
  function buildCards(
    world: readonly SettledEvent[],
    axis: NonNullable<ReturnType<typeof tl.axis>>,
    statuses: ReturnType<typeof coord.commitmentStatuses>,
  ): void {
    // Presence gating happens in the engine: a stream the player has toggled off
    // (e.g. missions) contributes no settled events, so its cards leave the
    // timeline with the income — no kind-hiding re-derivation here.
    const below = belowLaneCards(world, bundle, axis, now);
    const above = aboveLaneGroups(world, bundle, axis, now, {
      balanceAt: (date) => coord.balanceAt(date),
      availableFor: (key) => coord.availableFor(key),
      commitmentStatuses: statuses,
    });
    const belowEls = below.map((card) => belowCard(card, rush, fav, inspect));
    const aboveEls = above.map((group) => bannerGroup(group, fav, commit, inspect));
    cardStats = {
      cards: belowEls.length + aboveEls.length,
      aboveCards: aboveEls.length,
      belowCards: belowEls.length,
      timelineGolshis: cardStats.timelineGolshis,
    };
    tl.setCards([...belowEls, ...aboveEls]);
    // Mounted now → heights are measurable. Pack each lane (below returns its
    // floor depth, above its roof height); the timeline turns these into its
    // dynamic vertical roof/floor.
    const belowDepth = packBelowLane(below, belowEls);
    const aboveDepth = packAboveLane(above, aboveEls);
    tl.setContentDepth(aboveDepth, belowDepth);
    // Arm spatial culling: hand the substrate every card's id + element so it can
    // measure world bounds (now, with the packer settled) and thereafter mount only
    // the visible neighbourhood. Ids are lane-prefixed so a below event key and an
    // above group key (a bare date) can never collide in the live-set membership.
    tl.setScene([
      ...below.map((card, i) => ({ id: `below:${card.key}`, el: belowEls[i] })),
      ...above.map((group, i) => ({ id: `above:${group.key}`, el: aboveEls[i] })),
    ]);
    // Raise the stage lighting — the cards (the lead) are built, packed and culled, so spotlight
    // them. First call fades the layer up over 150ms; later rebuilds mount into the lit layer.
    tl.reveal();
  }

  // First mount defers the card build one frame; every later refresh builds inline so a toggle
  // or commit stays immediate.
  let cardsDeferred = false;
  function refresh(): void {
    // The settled world — the render source. One value feeds the fold AND the
    // lane; faces arrive resolved, so the cards never join back to the bundle.
    const world = coord.settledEvents();
    const projection = coord.projection();
    const extent = displayExtent(world);
    cardStats.timelineGolshis = extent ? timelineLengthGolshis(daysBetween(extent[0], extent[1])) : 0;
    // The minimap is another view over the same projection. Repaint it *before*
    // the timeline lays out: `tl.layout` emits the initial view-centre date
    // through `onView → mini.setView`, which needs the minimap's axis already
    // built (otherwise the first window placement is dropped).
    mini.refresh({
      series: projection.series,
      bundle,
      favourites: coord.document().favourites ?? {},
      commitments: coord.document().commitments ?? {},
      extent,
      now,
    });
    // The film strip is a third view over the same favourites map — the minimap's
    // ordinal twin. Each capsule's colour is the banner's commitment band (the same
    // grey/green/purple/red rule the badge + dossier use). The funding state is the
    // coordinator's cached `commitmentStatuses` — derived once, not re-run here.
    const statuses = coord.commitmentStatuses();
    const bands = new Map<string, PityBand>();
    for (const [key, status] of statuses) {
      bands.set(key, pityBand(status.pity, status.unfundable, PITY_WASTE_ABOVE[status.kind]));
    }
    strip.refresh(filmFrames(bundle, coord.document().favourites ?? {}, coord.document().commitments ?? {}, now, (key) => bands.get(key) ?? "empty"));
    // The extent is the displayed card range — all known time, first arrival to
    // last — so every card fits the canvas. `layout` pads PAD_DAYS either side
    // (the prototype's fixed buffer) and centres on today on first load.
    tl.layout(extent, now);
    const axis = tl.axis();
    if (!axis) return tl.setCards([]);
    // The chrome above (minimap/strip/timeline axis) is cheap and now painted. Only the card
    // build is heavy, so on the first mount defer it one frame — the real timeline + minimap
    // frame lands before the ~0.5s card materialisation (the gate). Re-read at fire time so a
    // resize during the gap doesn't build against a stale axis.
    if (!cardsDeferred) {
      cardsDeferred = true;
      requestAnimationFrame(() =>
        setTimeout(() => {
          const liveAxis = tl.axis();
          if (liveAxis) buildCards(coord.settledEvents(), liveAxis, coord.commitmentStatuses());
        }),
      );
    } else {
      buildCards(world, axis, statuses);
    }
  }
  coord.subscribe(refresh);

  // Viewport resize is a render-path event: the minimap axis/viewBox, the pan
  // bounds and the centred markers are all measured off clientWidth/Height, so a
  // resize must re-lay everything. rAF-coalesced so a drag-resize runs at most
  // once per frame rather than per resize tick.
  let applyTrainerPresentation = (): void => {};
  let resizePending = 0;
  window.addEventListener("resize", () => {
    if (resizePending) return;
    resizePending = requestAnimationFrame(() => {
      resizePending = 0;
      applyTrainerPresentation();
      refresh();
    });
  });

  // The view-state-driven layer: which surface is open is a discrete change, so
  // it flows through `subscribe` and re-renders here (the render path).
  const surfaceLayer = h("div", { class: "surface-layer" });
  const trainerLayer = h("div", { class: "trainer-page-layer" });
  applyTrainerPresentation = (): void => {
    const mode = trainerPresentation(capabilities.get(), window.innerWidth, window.innerHeight);
    trainerLayer.classList.toggle("trainer-page-layer--fullscreen", mode === "fullscreen");
    trainerLayer.classList.toggle("trainer-page-layer--rail", mode === "rail");
  };
  applyTrainerPresentation();
  capabilities.subscribe(applyTrainerPresentation);
  // The menubar's dropdown rail: a layer that mirrors the floating bar's geometry so
  // its surfaces drop in under the bar's own edges (left book off the left edge, right
  // resources off the right). Sibling to the bar today; the coherent-scale wrapper folds
  // both together next.
  const chromeDropdowns = h("div", { class: "chrome-dropdowns" });

  // Escape dismisses the topmost open surface — but only via its declared dismiss
  // affordance (surfaceClose / surfaceCancel), so it closes a viewer or backs out of a
  // pristine editor while staying inert over a pending decision. The modal layer paints
  // above the chrome rail, so it's offered first. Clicking the button reuses the surface's
  // own teardown (view-state set + side effects) — no separate dismiss path to keep in sync.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (view.get().trainer && surfaceLayer.childElementCount === 0) {
      e.preventDefault();
      view.set({ trainer: false, trainerChild: null });
      return;
    }
    const target = escDismissTarget(surfaceLayer, chromeDropdowns);
    if (!target) return;
    e.preventDefault();
    target.click();
  });

  // UmaMark — the deterministic benchmark (grand-masters/umamark.md). It scripts the camera
  // (tl.bench) and reads Darley's perf instrument; for the run it hides all chrome so the
  // world is the only thing stressed, then restores it. Constructed here, once every chrome
  // element it suppresses exists. Reachable only under `?umamark`, via the Beta chamber.
  const umamark = createUmaMark({
    timeline: tl,
    perf,
    mount: root,
    chrome: [menu.el, chromeDropdowns, surfaceLayer, trainerLayer, strip.el, mini.el, hud.el],
  });
  const launchUmaMark = (): void => {
    presentConfirm({
      title: "Run UmaMark",
      message:
        "UmaMark takes over the screen and drives a fixed camera workload over the timeline (~30–60s). Leave the screen alone while it runs.",
      confirmLabel: "Run",
      onConfirm: () => {
        view.set({ right: null }); // close the chamber; the harness hides the rest of the chrome
        void umamark.run();
      },
    });
  };
  const closeOshiSelector = () => view.set({ trainerChild: null });
  const closeClubSelector = () => view.set({ trainerChild: null });
  // Unity cloud — the trainer card's Cloud Save controls. Auth + last-sync state live
  // here (closure state, fetched ONCE at startup) rather than in the card, so the card's
  // frequent rebuilds (every coord notify, via renderSurfaces) never re-hit /api/me. Each
  // state change re-renders the card through renderSurfaces, the same path identity uses.
  let cloudAuth: AuthState = { authenticated: false };
  let cloudSyncing = false;
  let cloudOutcome: string | null = null;
  const cloudOutcomeLabel = (result: SyncResult): string => {
    switch (result.kind) {
      case "pushed":
        return "Synced to cloud ✓";
      case "fast-forwarded":
        return "Updated from cloud ✓";
      case "noop":
        return "Already up to date ✓";
      case "throttled":
        return "Just synced — give it a few seconds";
      case "error":
        return "Sync failed — try again";
      default:
        return "";
    }
  };
  const onCloud = (): void => {
    if (modalOpen()) return; // same belt-and-braces spawn guard as the other surfaces
    view.set({ cloudConnecting: true }); // tracked like every other modal → suspends + locks
  };
  const runSync = async (): Promise<void> => {
    if (cloudSyncing) return;
    cloudSyncing = true;
    cloudOutcome = "Syncing…";
    renderSurfaces();
    const result = await syncNow(coord);
    cloudSyncing = false;
    if (result.kind === "conflict") {
      cloudOutcome = "Conflict — choose a version to keep";
      renderSurfaces();
      presentCloudConflict(coord, result.conflict, (outcome) => {
        cloudOutcome = `Resolved — ${outcome}`;
        renderSurfaces();
      });
      return;
    }
    cloudOutcome = cloudOutcomeLabel(result);
    renderSurfaces();
  };
  const onSync = (): void => void runSync();


  // Live read of "is a modal (modal child window) up?" — the fallback guard for
  // every spawn control. Suspension already makes the controls unreachable; this
  // belt-and-braces refuses the spawn even if one slips through. A modal is modal
  // to ALL spawnable windows (feedback_shield_vs_unfold).
  const modalOpen = (): boolean => {
    return (
      view.get().trainerChild !== null ||
      view.get().resourcesEditing ||
      view.get().committing !== null ||
      view.get().cloudConnecting ||
      view.get().cardDetail !== null ||
      view.get().plan
    );
  };

  // The commit modal's spawn seam, handed to every banner readout: a banner's
  // commit control opens its modal, refused while any modal is already up (the
  // belt-and-braces guard — suspension already hides in-card pencils behind a
  // modal, this refuses a spawn that slips through). The modal itself renders in
  // the surface layer (renderSurfaces), modal to all spawnable windows.
  const commit: CommitBinding = {
    open: (bannerKey) => {
      if (!modalOpen()) view.set({ committing: bannerKey });
    },
  };

  // The card-detail spawn seam, handed to every banner atom chip: clicking an atom
  // opens its card surface, refused while any modal is already up (same guard as the
  // commit seam). Until now the only door to the card was the commit dossier's
  // featured grid — the banner chip is where a person actually clicks the atom.
  const inspect: InspectBinding = {
    open: (kind, id) => {
      // The timeline is always interactive (surface principle 1: the canvas stays live behind
      // a modal), so a banner-chip inspect lands whenever it safely can. With a card detail
      // already open it *swaps* the subject in place — but only while that card is pristine,
      // the same guard Esc uses: `escDismissTarget` is non-null iff the topmost surface (the
      // card) has no staged edits. A dirty card blocks the swap until Update/Cancel resolves
      // it (no silent loss of a staged note). With no card open, a *different* modal still
      // refuses the spawn (belt-and-braces past suspension).
      if (view.get().cardDetail !== null) {
        if (escDismissTarget(surfaceLayer)) view.set({ cardDetail: { kind, id } });
      } else if (!modalOpen()) {
        view.set({ cardDetail: { kind, id } });
      }
    },
  };

  // The Desk's in-progress note drafts, keyed by banner id. Held here — outside the
  // per-render surface tree — so a half-typed note survives the rebuild the Desk's own
  // children (card/dossier) trigger when they open. Cleared by the Desk on Update/Cancel.
  const planNoteDrafts = new Map<string, string>();

  function renderSurfaces(): void {
    const right = view.get().right as RightSurface | null; // right group
    // A modal (oshi or balance editor) is modal to ALL spawnable windows: it
    // locks the menu's surface spawners AND suspends every other open surface so
    // their in-card pencils can't spawn a second modal. One predicate, reused.
    const anyModal = modalOpen();

    menu.setIdentity(identity.menuIdentity());
    menu.setLeftActive(view.get().trainer);
    menu.setRightActive(right);
    // The Plan door appears only once the plan is non-empty (cached committed set).
    menu.setPlanAvailable(coord.commitmentStatuses().size > 0);
    // The Beta door is gated on the supporter entitlement (watched off cloud pulls).
    menu.setBetaAvailable(isSupporter());
    menu.setLocked(anyModal);

    const children: Node[] = [];
    // Rebuilt below if the Resources card is in this frame; the pan path checks it.
    liveResources = null;
    // The Cloud Save controls on the trainer card — built fresh each frame off the live
    // cloud state. Only one left-group branch runs per frame, so this single node mounts
    // at most once. `dirty` drives the Sync button's lit state.
    if (view.get().trainer) {
      const oshi = identity.currentOshi();
      trainerLayer.replaceChildren(
        trainerPage({
          trainerName: identity.trainerName(),
          oshiName: oshi.name,
          oshiPortrait: oshi.portrait,
          club: identity.club(),
          savedPlayStyleKey: identity.savedPlayStyleKey(),
          savedPlayStyleSettings: identity.savedPlayStyleSettings(),
          playStyleStrings: strings.playStyle,
          cloud: cloudControls({
            auth: cloudAuth,
            dirty: coord.syncMeta().dirty,
            syncing: cloudSyncing,
            outcome: cloudOutcome,
            onCloud,
            onSync,
          }),
          onTrainerNameChange: (name) => identity.setTrainerName(name),
          onOshiSelect: () => {
            if (!modalOpen()) view.set({ trainerChild: "oshi" });
          },
          onClubSelect: () => {
            if (!modalOpen()) view.set({ trainerChild: "club" });
          },
          onApply: (key, settings) => identity.commitPlayStyle(key, settings),
          onClose: () => {
            view.set({ trainer: false, trainerChild: null });
          },
        }),
      );
    } else {
      trainerLayer.replaceChildren();
    }

    if (view.get().trainer && view.get().trainerChild === "oshi") {
      children.push(buildOshiSelector(identity, { onClose: closeOshiSelector }));
    } else if (view.get().trainer && view.get().trainerChild === "club") {
      children.push(buildClubSelector(identity, { onClose: closeClubSelector }));
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
          if (!modalOpen()) view.set({ resourcesEditing: true });
        },
        onClose: () => view.set({ right: null, resourcesEditing: false }),
      });
      liveResources = resources; // the pan path refreshes this card in place
      const resourcesCard = surface({
        title: "Resources",
        placement: "right",
        headerless: true,
        body: resources.el,
        // Closing the surface tears the editor modal down with it.
        onClose: () => view.set({ right: null, resourcesEditing: false }),
      });
      children.push(resourcesCard);

      if (editing) {
        const balanceCard = surface({
          title: "Record Balance",
          placement: "center",
          headerless: true,
          body: resourcesEditor({
            snapshot: coord.document().snapshot,
            dailyPack: (coord.document().config?.["dailyPack"] as string | undefined) ?? null,
            trainingPass: coord.document().config?.["trainingPass"] === true,
            onCommit: ({ snapshot, dailyPack, trainingPass }) => {
              // The pack date and premium toggle are subscriptions (account-level
              // config), not part of the resource reading — two typed writes.
              coord.saveSnapshot(snapshot);
              coord.setSubscriptions({ dailyPack, trainingPass });
            },
            onClose: () => view.set({ resourcesEditing: false }),
          }),
          onClose: () => view.set({ resourcesEditing: false }),
        });
        children.push(balanceCard);
      }
    } else if (right === "beta") {
      const betaCard = surface({
        title: "Beta",
        placement: "right",
        headerless: true,
        body: betaSurface({
          onClose: () => view.set({ right: null }),
          onRunUmaMark: launchUmaMark,
          firstrun: coord.firstrun(),
          onSetFirstrun: (stage) => {
            coord.setFirstrun(stage);
            renderSurfaces(); // reflect the new watermark in the chip label
            startOnboarding(); // re-arm the tour from there, over the open chamber
          },
        }),
        onClose: () => view.set({ right: null }),
      });
      children.push(betaCard);
    }

    // The Cloud provider modal: spawned from the trainer card's Cloud button,
    // independent of the left/right groups. A modal like the commit/balance ones — it
    // sits in `anyModal` above (suspending the other surfaces + locking the menu) and
    // the timeline behind it stays live. Disconnect resets the app's cloud auth in place.
    if (view.get().cloudConnecting) {
      const closeCloud = (): void => view.set({ cloudConnecting: false });
      children.push(
        surface({
          title: "Cloud Save",
          placement: "center",
          headerless: true,
          body: cloudProvider({
            coord,
            auth: cloudAuth,
            onSignedOut: () => {
              cloudAuth = { authenticated: false };
              cloudOutcome = null;
            },
            onClose: closeCloud,
          }),
          onClose: closeCloud,
        }),
      );
    }

    // The Plan — the Desk (twinkle-monthly/cover.md): the whole-plan reading surface,
    // spawned from the menubar's tablet button. Pushed FIRST among the modals so it sits
    // at the BOTTOM of the stack — the dossier and card surfaces it spawns stack above it
    // (push order = paint order) and return focus to it on close. The timeline behind
    // stays live. Reads the cached committed set + shared pity-band rule.
    if (view.get().plan) {
      const statuses = coord.commitmentStatuses();
      const notes = coord.document().notes ?? {};
      const rows = planRows(bundle, statuses, fav.isFavourited, (key) => notes[key] ?? "");
      const oshi = identity.currentOshi();
      const planCard = surface({
        title: "The Plan",
        placement: "center",
        headerless: true,
        body: planSurface({
          rows,
          trainerName: identity.trainerName(),
          oshiPortrait: oshi.portrait,
          oshiName: oshi.name,
          fav,
          // The Desk intentionally STACKS its children (it stays open beneath them), so it
          // sets view directly rather than going through the guarded commit/inspect seams
          // (whose !modalOpen() refusal is for unintended spawns slipping past suspension).
          inspect: { open: (kind, id) => view.set({ cardDetail: { kind, id } }) },
          // Editing a pity warps the timeline behind to that banner AND opens the dossier
          // over the Desk — so closing back out of the stack lands on the right banner.
          onEditPity: (key) => {
            tl.warpTo(bundle.event(key).start);
            view.set({ committing: key });
          },
          // The banner note (the *why*) — keyed by the banner's stable id, same setNote
          // seam the card surface uses for atom notes (normalised + persisted by coord).
          onSetNote: (key, text) => coord.setNote(key, text),
          noteDrafts: planNoteDrafts,
          onClose: () => view.set({ plan: false }),
        }),
        onClose: () => view.set({ plan: false }),
      });
      children.push(planCard);
    }

    // The commit modal: spawned at source from a banner readout, independent of
    // the left/right groups. A modal (so it sits in `anyModal` above, suspending
    // the other surfaces); the timeline behind it stays live (it is transparent to
    // the canvas, like the balance editor).
    const committing = view.get().committing;
    if (committing !== null) {
      const ctx = commitContext(bundle, committing, {
        // The modal reads this banner's *self-excluded* available (income minus earlier
        // claims, not its own) so editing a committed pity never double-debits; an
        // uncommitted banner has no own-spend yet, so the series at its end is right.
        balanceAt: (date) => coord.availableFor(committing) ?? coord.balanceAt(date),
        commitments: coord.document().commitments ?? {},
      });
      const commitCard = surface({
        title: commitTitle(ctx), // kept as the dialog aria-label; the body renders its own title hero
        placement: "center",
        headerless: true,
        body: commitDossier({
          context: ctx,
          // Persist the pity as the unit of account; the carat cost stays derived
          // (principle 10). A null clears the commitment (0 through `commit`).
          onCommit: (pity, usePaid) => coord.commit(committing, pity ?? 0, usePaid),
          // Inspect a featured card → its detail surface (twinkle-monthly step 1).
          // The dossier rebuilds (losing an unsaved pity draft) — accepted for now.
          onInspect: (atom) => view.set({ cardDetail: { kind: ctx.kind, id: atom.id } }),
          onClose: () => view.set({ committing: null }),
        }),
        onClose: () => view.set({ committing: null }),
      });
      children.push(commitCard);
    }

    // The card detail surface (twinkle-monthly step 1): an art-forward peek at one
    // trainee/support atom, spawned at source (today the commit dossier's featured
    // cards). A modal like the others — it sits above the dossier that spawned it.
    const cardDetail = view.get().cardDetail;
    if (cardDetail !== null) {
      const detailCard = surface({
        title: "Card detail",
        placement: "center",
        variant: "card-detail",
        headerless: true,
        body: cardSurface({
          bundle,
          kind: cardDetail.kind,
          id: cardDetail.id,
          // Both fields are staged in the surface and applied together on Update — the only
          // write, so editing the card never refreshes the timeline until then. The favourite
          // lives here (the banner chip only reflects it); notes key by the subject's stable id.
          favourited: fav.isFavourited(cardDetail.id),
          note: coord.document().notes?.[cardDetail.id] ?? "",
          onCommit: ({ favourited, note }) => {
            // Only touch the favourite when it actually flipped — setFavourite refreshes the
            // timeline (the chip's pressed state), while the note write is silent.
            if (favourited !== fav.isFavourited(cardDetail.id)) fav.setFavourited(cardDetail.id, favourited);
            coord.setNote(cardDetail.id, note);
            view.set({ cardDetail: null });
          },
          onCancel: () => view.set({ cardDetail: null }),
        }),
        onClose: () => view.set({ cardDetail: null }),
      });
      children.push(detailCard);
    }

    // MODALITY — the lock fan-out, declared once (grand-masters/byerley-turk.md). A
    // surface that demands exclusivity (the `surface--modal` marker = the *modal*
    // trait + centred *placement*) locks the menubar — the spawn-tree root —
    // (menu.setLocked above) and suspends every other surface here, so no in-card
    // spawner can mint a surface that's born locked. The minimap is a sibling of the
    // menubar, outside this surface tree, so the lock never reaches it. Placement also
    // routes the node: centred modals into the surfaceLayer, everything else onto the
    // bar's rail in `chromeDropdowns`.
    const rail: Node[] = [];
    const modals: Node[] = [];
    for (const node of children) {
      (node instanceof HTMLElement && node.classList.contains("surface--modal") ? modals : rail).push(node);
    }
    if (anyModal) rail.forEach((node) => node instanceof HTMLElement && lockSurface(node));
    // A modal spawned from another modal (e.g. a card detail off the commit dossier)
    // stacks above its parent (DOM order = paint order, equal z-index). Suspend every
    // modal beneath the topmost so its controls can't be reached through the card in
    // front. (The richer cross-spawner rules can come when cards spawn from elsewhere.)
    modals.slice(0, -1).forEach((node) => node instanceof HTMLElement && lockSurface(node));
    chromeDropdowns.replaceChildren(...rail);
    surfaceLayer.replaceChildren(...modals);
    surfaceLayer.classList.toggle("surface-layer--over-trainer", view.get().trainer);
    surfaceLayer.classList.toggle("surface-layer--card-detail", cardDetail !== null);
    trainerLayer.classList.toggle("trainer-page-layer--locked", view.get().trainer && anyModal);
    // Same timing for the resources hero number: fit it to the card now it's measurable.
    liveResources?.fit();
  }
  view.subscribe(renderSurfaces);
  coord.subscribe(renderSurfaces);
  // Supporter entitlement flips asynchronously on cloud pulls — re-render so the Beta
  // door appears/disappears, and shut the chamber if it's open when entitlement drops.
  onSupporterChange((on) => {
    if (!on && view.get().right === "beta") view.set({ right: null });
    renderSurfaces();
  });

  // Mount order is the z-band: scenario wallpaper (back), timeline, then the surface
  // layer, with the menubar/minimap/film-strip lifted above all of it (their own
  // z-index) so the always-reachable chrome is never occluded.
  root.replaceChildren(menu.el, scen.el, tl.el, mini.el, strip.el, chromeDropdowns, trainerLayer, surfaceLayer, hud.el);
  renderSurfaces();
  // The gate: paint the chrome (menubar with folded numbers, minimap, film-strip, timeline axis)
  // synchronously, then `refresh` itself defers only the heavy card build a frame on first mount.
  // So the real frame — including the real minimap balance line — is up before the ~0.5s card
  // materialisation, with no blank handoff from the pre-fetch scaffold.
  refresh();

  // Special Week — first-run onboarding. Tazuna walks a brand-new trainer through the
  // two inputs that make the forecast theirs, then is gone for good. Runs only when the
  // synced `firstrun` watermark hasn't covered every stage; persists per-stage as it goes;
  // fail-soft (an onboarding hiccup must never wedge the app). LIVE for everyone — it
  // auto-runs a frame after `refresh()` below. The beta-chamber dev knob (supporter-gated)
  // stays as a re-arm seam so we can replay it if a first-run complaint comes in.
  let tour: OnboardingHandle | null = null;
  function startOnboarding(): void {
    tour?.dismiss(); // never stack two overlays (the dev knob can re-run mid-tour)
    try {
      tour = runOnboarding({
        firstrun: coord.firstrun(),
        onAdvance: (stage) => coord.setFirstrun(stage),
      });
    } catch (err) {
      console.warn("onboarding skipped:", err);
    }
  }
  // Deferred a frame so the live stage paints first and Tazuna reads as an entrance.
  requestAnimationFrame(() => startOnboarding());

  // Resolve the cloud session once, in the background, then re-render so the trainer
  // card's Cloud button reflects connected/disconnected. Signed-out on any error.
  void (async () => {
    cloudAuth = await fetchAuth();
    renderSurfaces();
  })();

  // Load-time cloud reconcile (design.md §5) — non-blocking + fail-soft: the UI is
  // already live off localStorage, and a signed-out 401 / network failure just leaves the
  // local plan in place. One bounded "free credit" reconcile per load (push-on-open).
  void (async () => {
    const result = await reconcileOnLoad(coord);
    // Chamber diagnostics: the path is otherwise silent, so a "nothing happened" is
    // hard to tell from a failure. Logs the decision (noop = clean+unchanged, or the
    // /api/sync 404 when not reachable e.g. the dev server; error = network/401).
    console.info("[unity] load sync:", result.kind, result);
    if (result.kind === "conflict") presentCloudConflict(coord, result.conflict);
  })();
}
