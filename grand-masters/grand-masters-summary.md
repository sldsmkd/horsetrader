# Grand Masters — as-built summary (audit)

> What actually landed on `main` from the sustained Grand Masters push, broken down
> by the three sires, plus where the phase boundaries were crossed, where new seams
> could be cut, and what the design docs describe that was *not* shipped.
>
> Audit date: 2026-07-03. Scaffold + rationale live in
> [grand-masters.md](grand-masters.md); this file is the ledger of the push.
> The integration phase that closed these threads is recorded at the bottom.

## Push status — everything is on `main`

The working branch **`gm-godolphin` was identical to `main`** (both at `62674ab`,
"filmstrip fixes"): no commits ahead, none behind — a spent branch (since deleted).
`byerley-turk` had already been deleted; `special-week-onboarding` is merged/behind. So
"the last big push" was fully integrated; the "skipped parts" below are **things the docs
specify that were never built**, not commits left unmerged.

The three phases map onto commit ranges, but **not cleanly** (see Boundary crossings):

| Phase | Commits | Dates | Rough diffstat |
| --- | --- | --- | --- |
| **Byerley** | `7b0173e` · `cb46791` · `98ceda6` | 2026-06-20 | 88 files, +1319 / −1033 |
| **Darley** | `435aa28` · `4f3440a` | 2026-06-20 | 8 files, +355 / −56 |
| **Godolphin** | `8721a5a` … `62674ab` | 2026-06-24 → 07-02 | 272 files, +17082 / −3703 |

Test posture at audit: **312 `test()` calls across 45 `*.test.ts` files**; tsc + build
clean per the phase worklogs (316 after the integration phase).

---

## Byerley Turk — Part 1: the glass substrate (shipped)

The disciplined, pixel-free orthographic glass system. What landed:

- **`css/glass.css` — the substrate.** `--glass-u` (behind a `vh` shim, later replaced
  by Darley), the depth ladder `--glass-z-*` (`wallpaper · world · surfaces` + the
  chrome/modal/alert paint lifts), and the holographic register
  (`--glass-bg/edge/edge-light/blur/radius/shadow`). Every pane frosts from the register.
- **`transform: scale` retired from the glass plane.** The projection-violation fix — the
  old `--chrome-dropdown-scale: 0.8` and rail-card `zoom` are gone; glass resizes
  dimensionally in `N × --glass-u`. `scale` is now the camera's exclusive privilege on the
  world plane.
- **Modality as a lock, not a shield type.** One composite-aware lock pass in
  `renderSurfaces()` keyed on the modal trait, fanning across the surface tree, navigation
  exempt by sibling geometry. **There is no "shield" type** — collapsed to one surface type
  with modal-demand + placement as orthogonal traits. Fixed a pre-existing bug where
  `placement:"center"` emitted `surface--center` but the router keyed `surface--modal`.
- **Reorg + rename.** Spawnable surfaces → `views/surfaces/`, widgets → `views/widgets/`.
  Vocabulary collapsed: `overlay()`→`surface()`, `shieldOpen/anyShield/setShielded`→
  `modalOpen/anyModal/setLocked`, `*Shield` files role-named.
- **Whole glass plane migrated to `N × --glass-u`** (`views/surfaces/*.css` +
  `views/widgets/*.css` + `menubar`/`bookmarks`/`minimap` outer offsets + `scenarioArt`),
  and `css/typography.css` rebased so `--ht-type-*` sizes ride the unit too. World-plane
  cards (`bannerGroup`/`belowCard`/`card`/`timeline`) deliberately excluded — they're
  carried by the camera.
- **Last magic numbers declared:** `1000 - offset` → `BELOW_LANE_STACK_TOP` in
  `views/timeline/constants.ts` (the world plane's own paint order, outside the glass ladder).

Full detail: [byerley-turk.md](byerley-turk.md) · [byerley-outstanding.md](byerley-outstanding.md).

---

## Darley Arabian — Part 2: grounding on real hardware (shipped)

Surgical, not a sweep — Byerley's abstract-first win shrank the brief. What landed:

- **`ui/glassUnit.ts` — the glass-u→px bridge.** `resolveLengthPx` probe: JS reads the
  browser-resolved custom property at the correct root, refreshed on view change. The
  legitimate CSS-to-device calibration seam.
- **The unit resolved honestly.** The `1vh` shim became
  `--glass-u-device-calibration: clamp(7px, min(1svh, 2svw), 20px)` — the Unity CanvasScaler
  "match-height, width-vetoed, px-clamped" idiom on the calm `svh`/`svw` (not reflow-y `dvh`).
  `--glass-u: var(--glass-u-device-calibration)` is the public ruler; a private per-ancestor
  ruler was rejected (a `7u` control must be one physical size regardless of lineage).
- **`zMin` derived (fit-to-height); `zMax` stays feel.** Screen-space vs feel is the load-
  bearing cut — pan bounds already read the viewport live and were left; only the fit-zoom
  floor was derived. The eye-tuned zoom *range* is untouched.
- **The rail seam made executable.** `TRACK_RAIL_VISUAL_PX` **deleted**;
  `--timeline-rail-height` (`calc(2.5 × --glass-u)`) is the single source, read through the
  bridge into the derail-gesture math, with `railSeam.test.ts` guarding that a later tidy
  can't fold one side back to a constant.
- **Blur policy: parked → KEEP, always-on.** UmaMark measured frost cheap (free on a 7900XT,
  +1.0ms p95 on a 60Hz iPhone 14). The token stays the one knob.

Full detail: [darley-arabian.md](darley-arabian.md).

---

## Godolphin Barb — Part 3: device-specific representation (shipped, largest phase)

The `8721a5a…62674ab` range is huge (272 files) because it bundles more than the mobile
work (see Boundary crossings). The genuinely *Godolphin* content — alternate
representations chosen when the single mapping stops serving:

- **`ui/caps/` — the capability+policy substrate (the core seam).**
  - `capabilities.ts`: the *qualitative, feature-detectable* half (`pointer`, `anyCoarse`,
    `hover`/`noHover`, `touchPoints`, plus `reducedMotion`/`contrast`/`forcedColors`/
    `reducedTransparency`). Reactive `matchMedia`, never polled. Discipline: **capability ≠
    state** (orientation refused as flaky) and **capability ≠ Darley's px facts**.
  - Pure presentation policies, each `caps + viewport extent → form`:
    `trainerPresentation` (`rail | fullscreen`), `menubarPresentation` (`visible | hidden`),
    `timelineChromePresentation` (`filmstrip-only | minimap-only | …`),
    `scenarioPresentation` (`visible | hidden`), plus `glassTarget` (coarse `7u` / fine tier).
- **Trainer page — the first alternate surface, promoted to standard (2026-06-25).** The
  portrait `mobileTrainerPage.ts` tested better than the desktop two-window book and became
  `views/trainer/trainerPage.ts`. It merges identity + Play Style into one native-scrolling
  document; the old `playStyleMachine.ts`, `TrainerCard`, second Play Style window, drawers,
  and height-matching book were **deleted**. Play Style content was split into
  `playStyleSettingsModel.ts` (inventory) + `playStyleSettings.ts` (shared controls) so
  desktop drawers and portrait sections compose the same controls. iPad-Air landscape
  sharpened the non-phone path from "floating" to **menubar rail**.
- **Phone takeovers (2026-07-02).** Plan/Desk, Record Balance, Resources dropdown, and the
  commit dossier each consume the shared coarse-phone policy: full-viewport document above
  all chrome, back-mast, sticky equal actions, Tosen typography roles, safe-area padding.
  Desktop representations stay modal.
- **Portrait/landscape timeline chrome.** Portrait phone → `filmstrip-only` (minimap
  suppressed but keeps measurable geometry); landscape phone → `minimap-only` + menubar
  removed; scenario wallpaper dropped on phones in both orientations. Filmstrip gained an
  ordinal read-head drag.
- **Golshi — the world unit (`--world-golshi: 35px`).** The camera-plane counterpart to
  glass-u: `1g = 35px` atom-chip target, full card `= 8g`, compact `= 4g`, guarded by
  `worldUnit.test.ts`. Sizes interaction surfaces *inside* the camera-scaled world, where
  glass-u must not reach.

Detail: [godolphin-barb.md](godolphin-barb.md) · [mobile-worklog.md](mobile-worklog.md) ·
[contracts.md](contracts.md).

---

## Boundary crossings (where the phase cut blurred)

1. **Commit ranges ≠ phase ownership.** UmaMark is Darley's perf half by *design* (it
   settled her blur policy), but the `umamark/` files landed inside the Godolphin commit
   range (2026-06-24+). Likewise the image broker (`image.ts`), onboarding, the `select/`
   refactor, and filmstrip rode the same range. The `8721a5a…62674ab` band is a *time
   window*, not a Godolphin manifest — don't read the diffstat as Part-3 scope.
2. **The metaphor is provenance, not contract** ([contracts.md](contracts.md) opening).
   The sires were a reasoning scaffold; the durable artifacts got renamed by their own
   physics (**Golshi**, the **capability substrate**). Attributing a file to a sire is
   archaeology, not an ownership boundary.
3. **The Darley/Godolphin line moved during the build.** `byerley-outstanding.md` still
   records Godolphin as **DEFERRED / "phone is not a supported target"** (2026-06-21) — then
   two weeks of real Godolphin work shipped. That handoff doc is now stale; this summary
   supersedes its seam section.
4. **`glassUnit.ts` (Darley) is read by Godolphin policies and the SIZE-DEBUG probe.** This
   is the *intended* seam (CSS owns the mapping, JS observes the resolved quantity), not a
   violation — but it means Darley's bridge is now a load-bearing dependency of Part 3, not a
   closed Part-2 artifact.

## Potential seams to introduce (cleanup / where the next cut wants to go)

1. **Extract a device-class derivation.** The predicate
   `caps.pointer === "coarse" && caps.noHover && caps.touchPoints > 0` (`touchFirst`) is
   **copy-pasted verbatim in all five** `caps/*.ts` policies, and `Math.min(w,h) <= 600`
   (with orientation variants) is duplicated alongside it. A single
   `deviceClass(caps, viewport) → phone/tablet/desktop (+orientation)` seam would centralize
   the swap threshold that is currently smeared across every policy.
2. **Accessibility capabilities are detected but consumed by nothing.** `reducedMotion`,
   `reducedTransparency`, `contrast`, and `forcedColors` are read and unit-tested in
   `capabilities.ts`, but **no production policy reads them** (only the `.test.ts` files
   reference them). The near side of the seam exists; the far side is empty.
3. **Safe-area insets as an aperture field.** Deferred by design — needs
   `viewport-fit=cover` in `index.html` (an app-wide change) before `env()` reads non-zero.
   Darley's aperture is the natural home; recording the inset is Darley, reflowing to it is
   Godolphin. Currently phone takeovers hand-apply `safe-area` padding per surface.
4. **Formalize the mobile icon token.** `--glass-target` (coarse `7u`) is already a CSS
   token, but the measured `8u / 56px` touch-target and graphic-box standards from the field
   reads were left as `rem` happy-accidents pending a corrected device read.

## Missing / skipped — specified but NOT built

1. **Self-owned orientation (the big one).** [contracts.md](contracts.md) (F11) designed an
   *app-driven* rotation: own orientation as a modality trait via CSS `rotate` +
   input-frame rotate, with a **reconcile-on-text-input** dance against `screen.orientation`
   for the OS keyboard. **None of this shipped.** The live policies key off short-edge
   extent + capabilities — the *incidental-fit* approach.
2. **Device *class* modeling** — see seam #1. Left as ad-hoc per-policy predicates.
3. **Fast-pan card churn** — explicitly **accepted as-is** (iPhone 44fps on worst-case fling);
   the Trackblazer pooling/batching revisit stays parked, not built.
4. **Mobile icon token migration** — see seam #4; measured, not locked.
5. **Orphan left behind:** the now-empty `horsetrader.site/js/src/ui/views/mobile/`
   directory (from `mobileTrainerPage.ts`'s promotion to `views/trainer/`).

---

## Integration phase — CLOSED 2026-07-03 (branch `grandmasters-integration`)

Every open thread above was resolved in the integration pass:

- **Seam #1 built:** `ui/caps/deviceForm.ts` — the shared
  `caps + extent → phone-portrait | phone-landscape | spacious` derivation; the extent
  policies now consume it (square viewport deliberately ties to portrait). Guarded by
  `deviceForm.test.ts`; the untouched policy tests double as refactor-preservation proof.
- **Seam #2 decided:** a11y capabilities stay **dormant** by choice (no speculative
  behavior); recorded as a dormant seam in contracts.md.
- **Seam #3 deferred:** safe-area as an aperture field still waits on `viewport-fit=cover`.
- **Seam #4 verified closed:** the trainer selector and all takeover primary controls
  already ride `--glass-target`; the remaining rems are cosmetic/graphic boxes (e.g. the
  `aria-hidden` portrait-edit pencil inside the whole-portrait button). No migration needed.
- **Missing #1 resolved by decision:** self-owned orientation **RETIRED 2026-07-03** — the
  takeover surfaces made mobile usable without rotation. Design record kept in contracts.md
  (RETIRED section) + godolphin-findings.md; the iOS keyboard-sequencing findings stay
  banked.
- **C-B4 guard built** (`glassDimensional.test.ts`: steady-state scan, keyframes/grayscale
  exempt); it caught and fixed one live violation — the menubar identity avatar's
  `scale(1.3)` became an honest 1.3× dimension with negative re-centre margin.
- **Housekeeping done:** `gm-godolphin` branch deleted, empty `views/mobile/` removed,
  the eight phase docs carry SUPERSEDED banners, contracts.md is the one living doc.

Still open by design: fast-pan churn (accepted), safe-area aperture field (gated),
C-B6 culling exception (gated on a real-device repro; intended fix is the frustum reframe).
