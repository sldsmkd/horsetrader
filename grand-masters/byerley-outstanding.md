# Byerley Turk — outstanding work (handoff)

Cold-start pickup for Part 1. Full design + rationale is in
[byerley-turk.md](byerley-turk.md); project frame in [grand-masters.md](grand-masters.md).
This file is just *what's left*.

> **CLOSED 2026-06-21.** Everything below is done. Byerley Part 1 shipped and deployed; the
> two items it handed forward both landed in **Darley** (Part 2, also merged + deployed): the
> rail-extent seam was built (glass-u→px bridge), and the parked `--glass-blur` decision was
> *settled by measurement* — **UmaMark** benchmarked frost as cheap (free on a 7900XT, +1ms p95
> on a 60Hz iPhone 14), so it stays always-on. The only remaining thread is the **Godolphin**
> (Part 3) mobile seam — now with a concrete first target: UmaMark's Fillrate pass measured the
> iPhone dropping to 44fps / 40% over on a worst-case fast pan (main-thread card churn, *not*
> frost). Per-item status updated inline below.

## Status — shipped (branch `byerley-turk`)

Commits on the branch: `7b0173e` (turk baseline) → `cb46791` (tidy up views) →
`ee62d80` (consolidate widgets) → `7a26022` (handoff doc). **243 tests green, tsc + build
clean.** UNCOMMITTED in the tree (2026-06-20): the full `--glass-u` migration (#1 below)
across 32 CSS files + the `surface--modal` bugfix.

- **Spine (Phases A–E):** `css/glass.css` holds the glass substrate — `--glass-u`
  (with the delete-on-Darley `vh` shim), the depth ladder `--glass-z-*`, and the
  holographic register (`--glass-bg/edge/edge-light/blur/radius/shadow`). All panes
  frost from the register. `transform: scale` retired from glass (rail cards now use
  honest `zoom`). Chrome float offsets ride `calc(N * --glass-u)`.
- **Modality:** one declared, composite-aware lock pass in `renderSurfaces()`
  ([app.ts](../horsetrader.site/js/src/ui/app.ts)) — keyed on the modal trait, fans
  across the surface tree, navigation exempt by sibling geometry. No "shield" type.
- **Reorg + rename (done, not outstanding):** spawnable glass surfaces live in
  `views/surfaces/`, all widgets in `views/widgets/`. Vocabulary collapsed:
  `overlay()`→`surface()`, `.overlay*`→`.surface*`, `shieldOpen/anyShield/setShielded`
  →`modalOpen/anyModal/setLocked`, `*Shield` files role-named (confirm / commitDossier /
  cloudProvider). `ui/` is clean of `overlay`/`shield` except the
  `feedback_shield_vs_unfold` tenet token.

## Outstanding

1. **Long-tail surface-internal `--glass-u` migration — DONE 2026-06-20.** The whole
   glass plane now measures in `N × --glass-u`. Convention (recorded in
   [surface.css](../horsetrader.site/js/src/ui/views/surfaces/surface.css) header):
   geometry (`gap`/`padding`/`width`/`height`/offsets/track sizes) → `calc(N × --glass-u)`,
   `N = rem × 1.25` (1 glass-u ≈ 0.8rem at the dev calibration); loose `font-size` routed
   to the nearest `--ht-type-*` token; `border-radius`/`outline-offset`/hairline borders/
   shadows left cosmetic; `100vw`/`100vh` clamps + px media breakpoints left (Darley/
   Godolphin seam). Scope: all of `views/surfaces/*.css` + `views/widgets/*.css`, **plus**
   the chrome/glass top-level files (`menubar`, `bookmarks`, `minimap` outer offsets only —
   its dots/window/needle stay symbolic px, `scenarioArt`). **Deliberately excluded:**
   world-plane cards (`bannerGroup`, `belowCard`, `card`, `timeline`) — they're carried by
   the camera's `scale(z)` and measure in world units the zoom scales; migrating them to a
   viewport unit would fight the camera. `perfHud` (debug) also left.
   - **Pre-existing bug fixed in passing:** `placement: "center"` emitted `surface--center`,
     but the router (app.ts) + CSS key on `surface--modal` — so every centred modal rendered
     as a narrow left-pinned plain surface AND got swept into the rail lock that scrimmed it
     against itself (needed a reload to recover). [surface.ts](../horsetrader.site/js/src/ui/views/surfaces/surface.ts)
     now maps center → the `surface--modal` marker. Introduced by the `cb46791` rename.
   - **Residual (type-layer rebase) — DONE 2026-06-20.** `css/typography.css` rebased onto
     glass-u in ONE pass: every `--ht-type-*-size` is now `calc(N × --glass-u)`, `N = rem ×
     1.25` (line-heights/weights/spacing stay unitless ratios; original rem noted inline).
     The 2 sub-token loose fonts in
     [forecast.css](../horsetrader.site/js/src/ui/views/widgets/forecast.css) (`__pct`,
     `__count`) moved to `calc(N × --glass-u)` directly (below the smallest token). Only
     `perfHud.css` (debug, excluded) keeps loose rem fonts. **Eyeball gate: text now scales
     with the plane — confirm sizes read right at the dev calibration.**

2. **Finishing-pass items — now unblocked by #1:**
   - **a. Retire the rail-card `zoom` — DONE 2026-06-20.** `zoom` is gone from the glass
     plane. glass.css now splits the unit: `--glass-u-base` (authoritative, the shim) and
     `--glass-u: var(--glass-u-base)` (the local surface unit). The dropdown rail
     ([surface.css](../horsetrader.site/js/src/ui/views/surfaces/surface.css)) sets a local
     `--glass-u: calc(var(--chrome-dropdown-u-scale) * var(--glass-u-base))` (0.8×) on the
     rail cards, so they shrink *dimensionally* — genuinely smaller, not zoomed. The
     misnamed `--chrome-dropdown-zoom` token → `--chrome-dropdown-u-scale`. Chrome-frame +
     clearance tokens ([base.css](../horsetrader.site/css/base.css)) now read
     `--glass-u-base`, so a rail card's local shrink can never perturb the fixed chrome or
     its viewport-clearance math. **Eyeball gate: confirm the menubar dropdowns still shrink
     correctly off their pinned edges.**
   - **c. Chrome sizing-token layer → glass-u — DONE 2026-06-20.** The chrome frame
     ([base.css](../horsetrader.site/css/base.css)) now measures entirely in `--glass-u`:
     `--timeline-chrome-height` (was the lone fixed `64px`), `-gap`, `-max-width`, and the
     dropdown clearance all ride the unit, so Darley has ONE knob (the glass-u definition)
     driving the whole tier. `--timeline-chrome-width: 85vw` stays — it's a responsive
     proportion, not a dimension (Darley's proportion-vs-derived-width call).
   - **b. Declare the last z scatter — DONE 2026-06-20.** The `1000 - offset` magic number
     in [app.ts](../horsetrader.site/js/src/ui/app.ts) (below-line card stacking) is now the
     declared `BELOW_LANE_STACK_TOP` constant in
     [timeline/constants.ts](../horsetrader.site/js/src/ui/views/timeline/constants.ts),
     documented as the *world* plane's own paint order — deliberately outside the glass
     depth ladder (`--glass-z-*`).

3. **Parked decision — register backdrop blur — RESOLVED 2026-06-21 (KEEP, always-on).**
   `--glass-blur` (`backdrop-filter`) re-rasterizes the live timeline every frame, so it was
   left in (looks right) but un-settled pending a benchmark. **UmaMark** (the deterministic
   benchmark built in Darley's perf half — see [umamark.md](umamark.md)) supplied the
   measurement: frost is **cheap, not the mobile killer it was feared to be** — free on a
   desktop 7900XT (vsync-bound, +0.0ms) and just **+1.0ms p95** over opaque on a 60Hz iPhone 14
   (the alpha/blend compositor path is fast on real mobile hardware). No perf budget / reduced
   radius / opaque-fallback needed on perf grounds. (`prefers-reduced-transparency` remains an
   *accessibility* option, orthogonal to perf — parked, not required.) The token stays the one
   knob if a future device ever changes the answer.

4. **Loose end — the paint lifts — SETTLED 2026-06-20 (KEEP).** `--glass-z-chrome` /
   `--glass-z-modal` / `--glass-z-alert` stay. They aren't modality (the lock handles
   that) — they're paint order, an orthogonal axis: the menubar is *visible-but-locked*
   under a modal (visibility ≠ interactivity). They're the legitimate front of the depth
   ladder, not lock leakage. glass.css comment updated to record the settled call.

## Seams — explicitly NOT Byerley

- **Darley (Part 2) — DONE 2026-06-21 (merged + deployed).** Real `--glass-u` px derivation
  (the shim became `--glass-u-base: clamp(7px, min(1svh, 2svw), 20px)`), responsive zoom limits
  (`zMin` derived from fit-to-height, `zMax` left feel), and the camera-meets-display seam, all
  built and signed off across all 5 deliverables + a real-iPhone mobile pass.
  - **Plane extents → glass-u — DONE.** The load-bearing rail seam landed: new
    [glassUnit.ts](../horsetrader.site/js/src/ui/glassUnit.ts) is the glass-u→px bridge
    (`resolveLengthPx` probe), `--timeline-rail-height` is the single CSS source
    (`calc(2.5 × --glass-u)`), timeline.ts reads it cached through the bridge, the
    `TRACK_RAIL_VISUAL_PX` constant is **deleted**, and `railSeam.test.ts` guards the coupling
    so a later tidy can't fold one side back to a constant. (The world *cards* stay
    camera-scaled world units, as designed.)
- **Godolphin (Part 3) — DEFERRED; phone is NOT a supported target right now.** Byerley's
  pixel-free abstraction + Darley's single mapping made the phone *incidentally usable* — a
  byproduct of getting the substrate right, **not** a support commitment. So this isn't a
  near-term routing chore. When/if phone becomes a target, Godolphin is a **wider product
  rethink of the app's intended purpose on the form factor** (what does this even do on a
  phone?), of which media-query/device-class routing + surface substitution are just the
  eventual implementation tail. Gated on that product decision, not queued. The phone stopgap
  stays as-is.
  - **Fast-pan churn — ACCEPTED AS-IS 2026-06-21 (NOT pursued).** UmaMark's Fillrate pass
    measured the iPhone dropping to 44fps / 40% over / 105ms max on a worst-case fast pan —
    main-thread card **churn** (mount/unmount + paint of entering cards), *not* GPU/frost. User
    call: that's not how the app is used (fling-scrubbing is bells-and-whistles), degraded-not-
    broken, chugging is fine. So the Trackblazer pooling/batching revisit **stays parked**, not
    a Godolphin deliverable — banked only so it isn't re-litigated as live work.

## Verify (from `horsetrader.site/`)

`npm run check` (tsc) · `npm run build` (esbuild) · `npm test` (245 tests) · dev server
on `:3000` for eyeball (reuse the standing one; don't screenshot-verify UI tweaks).
