# Byerley Turk — outstanding work (handoff)

Cold-start pickup for Part 1. Full design + rationale is in
[byerley-turk.md](byerley-turk.md); project frame in [grand-masters.md](grand-masters.md).
This file is just *what's left*.

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
   - **Residual (type-layer rebase — the deferred gate):** the `--ht-type-*` token layer is
     still rem. "Geometry + type" means text should scale with the plane too — do that as ONE
     rebase of `css/typography.css` onto glass-u (carries all token-driven text at once),
     then mop up the 2 sub-token loose fonts left in
     [forecast.css](../horsetrader.site/js/src/ui/views/widgets/forecast.css) (`__pct` 0.6rem,
     `__count` 0.66rem — no token fits). Its own eyeball gate.

2. **Finishing-pass items — now unblocked by #1:**
   - **a. Retire the rail-card `zoom`.** Today the dropdown shrink is honest `zoom`
     ([surface.css](../horsetrader.site/js/src/ui/views/surfaces/surface.css)
     `--chrome-dropdown-zoom`). Now that the rail cards' internals measure in `--glass-u`,
     the 0.8 can become a *local `--glass-u` override* and `zoom` comes out — they shrink
     because they're dimensionally smaller, not zoomed.
   - **c. Chrome sizing-token layer → glass-u — DONE 2026-06-20.** The chrome frame
     ([base.css](../horsetrader.site/css/base.css)) now measures entirely in `--glass-u`:
     `--timeline-chrome-height` (was the lone fixed `64px`), `-gap`, `-max-width`, and the
     dropdown clearance all ride the unit, so Darley has ONE knob (the glass-u definition)
     driving the whole tier. `--timeline-chrome-width: 85vw` stays — it's a responsive
     proportion, not a dimension (Darley's proportion-vs-derived-width call).
   - **b. Declare the last z scatter.** `els[i].style.zIndex = 1000 - offset`
     ([app.ts](../horsetrader.site/js/src/ui/app.ts) ~L109) is *world*-plane (below-line
     card stacking), correctly outside the glass depth ladder — but still a magic
     number. Bring it under declared order (a world-plane stacking token / rule).

3. **Parked decision — register backdrop blur.** `--glass-blur` (`backdrop-filter`)
   re-rasterizes the live timeline every frame; brutal on CPU/GPU, especially mobile.
   Left in (looks right) but **un-settled — benchmark before locking**; may need a perf
   budget / reduced radius / opaque fallback. Revisit owned by **Darley** (hardware) +
   **Godolphin** (mobile); the token is the one knob. See byerley-turk.md "Parked
   decision".

4. **Loose end — the paint lifts.** `glass.css` flags `--glass-z-chrome` /
   `--glass-z-modal` / `--glass-z-alert` as "candidates to dissolve into the lock."
   Modality is now a lock, but the chrome lift stays legitimate (menubar is
   *visible-but-locked* under a modal — visibility ≠ interactivity). Likely **keep
   as-is**; just decide consciously and update the comment if so.

## Seams — explicitly NOT Byerley

- **Darley (Part 2):** real `--glass-u` px derivation (fix-height / derive-width,
  `vmin`/`clamp`, responsive zoom limits), the camera-meets-display seam. The shim is
  hers to replace (delete-on-Darley).
  - **Plane extents → glass-u (handed to Darley 2026-06-20).** The world *cards* stay
    their own thing (camera-scaled world units — `bannerGroup`/`belowCard`/`card`, the
    `timeline/constants.ts` feel knobs). But the plane's screen-fixed extents want glass-u
    too — and the load-bearing one isn't a clean CSS swap: `TRACK_RAIL_VISUAL_PX = 32`
    ([constants.ts](../horsetrader.site/js/src/ui/views/timeline/constants.ts)) feeds BOTH
    the CSS visual (`--timeline-rail-height`, set inline in timeline.ts) AND the JS
    derail-gesture math (timeline.ts ~L191, `TRACK_DERAIL_PX + TRACK_RAIL_VISUAL_PX / 2`).
    So the rail extent is one screen-px value shared by CSS-visual + JS-gesture-feel;
    moving it to glass-u means threading the real glass-u→px value into the JS feel layer
    — exactly Darley's derivation. Move them together or they desync.
- **Godolphin (Part 3):** mobile/touch/alternate representations. The phone stopgap
  stays as-is.

## Verify (from `horsetrader.site/`)

`npm run check` (tsc) · `npm run build` (esbuild) · `npm test` (243 tests) · dev server
on `:3000` for eyeball (reuse the standing one; don't screenshot-verify UI tweaks).
