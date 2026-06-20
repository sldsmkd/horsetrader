# Byerley Turk — outstanding work (handoff)

Cold-start pickup for Part 1. Full design + rationale is in
[byerley-turk.md](byerley-turk.md); project frame in [grand-masters.md](grand-masters.md).
This file is just *what's left*.

## Status — shipped (branch `byerley-turk`)

Commits on the branch: `7b0173e` (turk baseline) → `cb46791` (tidy up views) →
`ee62d80` (consolidate widgets). Working tree clean. **243 tests green, tsc + build
clean, user-verified spacing + modals.**

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

1. **Long-tail surface-internal `--glass-u` migration** *(the main remaining Byerley
   work — deferred by the scoped decision, on purpose).* Surface internals still use
   `rem`/`vw`/`px` (≈the sprawl in `views/surfaces/*.css` + `views/widgets/*.css`).
   Migrate them to `N × --glass-u` so the whole glass plane is structurally
   resolution-independent. Do it incrementally, not big-bang; eyeball on the dev server.

2. **Finishing-pass items — land WITH #1, not as new phases:**
   - **a. Retire the rail-card `zoom`.** Today the dropdown shrink is honest `zoom`
     ([surface.css](../horsetrader.site/js/src/ui/views/surfaces/surface.css)
     `--chrome-dropdown-zoom`). Once the rail cards' internals measure in `--glass-u`,
     the 0.8 becomes a *local `--glass-u` override* and `zoom` comes out — they shrink
     because they're dimensionally smaller, not zoomed.
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
- **Godolphin (Part 3):** mobile/touch/alternate representations. The phone stopgap
  stays as-is.

## Verify (from `horsetrader.site/`)

`npm run check` (tsc) · `npm run build` (esbuild) · `npm test` (243 tests) · dev server
on `:3000` for eyeball (reuse the standing one; don't screenshot-verify UI tweaks).
