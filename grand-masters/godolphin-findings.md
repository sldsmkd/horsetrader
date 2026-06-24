# Godolphin — field findings (portrait phone)

> Live field study on iPhone (1170×2532, real device over LAN). Capture raw
> observations + commentary here as we browse; derive the plan from the patterns,
> not reactively. See [godolphin-barb.md](godolphin-barb.md) for thesis/deliverables.

## Device

- iPhone, 1170×2532 physical, portrait. Safari. Reached via `0.0.0.0:3000` over LAN.

## Findings

### F1 — Onboarding coachmark on first load (screenshot 1)

Context: cold load, first-run Tazuna onboarding overlay showing the intro panel
("Horsetrader helps you plan future banners…", Skip / Start setup).

Observations:
- **Timeline is collapsed desktop chrome, not a portrait form.** Banner cards render
  at desktop width in a single cramped column; faces/labels squeezed; cards bleed off
  both edges. This is the stopgap (`100vw` clamp) we expect to retire.
- **Top chrome squished.** Home icon + oshi dropdown + carat counter on row 1, search
  full-width on row 3 (the menubar stack stopgap). Carat "0" pill floats oddly far right.
- **Minimap** is a thin strip at the very bottom — fine in principle, but it's the only
  "timeline overview" and it's tiny on a tall screen.
- **Onboarding panel** itself reads okay at this width (centred, legible).

Open questions:
- Is one-column-of-desktop-cards the right portrait timeline, or does portrait want a
  fundamentally different distribution?

### F2 — Surfaces are resized desktop windows, not portrait forms (screenshots 2 & 3)

Context: onboarding steps spotlighting the identity surface (left, "Unknown" portrait
card) and the resources surface (right, carat projection / Limit Breakers / Record
Balance).

Observations (user commentary):
- **"Almost max width but not quite."** Surfaces are desktop modals scaled to ~90%
  viewport width — committed to neither a real margin nor true full-bleed. The
  in-between leaves dead gutters and a "shrunk window" feel rather than an intended
  portrait panel.
- **Left and right surfaces clobber each other.** The left (identity machine) and right
  (resources/tazuna/plan) surface groups are both near-full-width, so on a narrow
  viewport they overlap/stack into each other instead of being one thing at a time.
  Portrait has room for exactly one surface column — the left/right split (a desktop
  spatial idiom, see [[project_surface_groups]]) doesn't survive here.
- Surfaces themselves (the carat projection card) are otherwise legible and well-formed.

### F4 — Touch gesture collision: surface scroll vs timeline pan (screenshot 4)

Context: opened Custom play style; the Custom config panel expands *below* the play-style
grid, off the bottom of the screen. Tried to scroll down to reach it.

Observations (user commentary):
- **Couldn't scroll to the expanded panel.** The Custom panel opened below but was
  unreachable — vertical drag didn't scroll the surface content.
- **The pan gesture hit the timeline instead.** The drag panned the world axis into the
  far future, so the projection now reads ~323,550 carats. The timeline's
  `setPointerCapture` pan ([[project_in_timeline_controls_pattern]]) swallowed the
  gesture meant for surface content.
- Underlying cause: on desktop the surface is a floating panel over a click-to-pan world
  and the two never fight; on touch, a vertical drag is *both* "scroll this panel" and
  "pan the world", and the world is winning. There is no scroll containment / gesture
  arbitration for portrait.

### F5 — Surface + shield stack into one accidental column (screenshot 5)

Context: resources surface (carat projection / Limit Breakers, top) with the Record
Balance editor shield open (bottom). On desktop these are deliberately split: surface =
read, shield = modal write ([[feedback_shield_vs_unfold]],
[[project_resources_surface_refactor]]).

Observations (user commentary):
- **"Separate windows that come out okay accidentally — but should just be one."** On
  portrait they stack vertically and read fine *by luck*, not design. The display≠edit
  rationale that justifies two panels on desktop buys nothing here: there's no spatial
  context to preserve behind the modal (the surface is already full-width above it).
- Implication: portrait may want the shield to **unfold inline into the surface** rather
  than float as a separate modal — the read panel and its editor become one scrollable
  sheet. (Inverts the desktop shield tenet *for this device* — a Godolphin call: the
  single representation's rule stops serving, so the alternate form takes over.)
- Record Balance form itself lays out acceptably (4-col input grid wraps to 2 rows).

### F6 — Join Club modal overflows the viewport width (screenshot 6)

Context: club rank selector (`clubSelector`) opened from the identity surface.

Observations (user commentary):
- **Modal is too wide to display.** The 3-column rank grid is sized to desktop; on
  portrait it spills past *both* edges — the leftmost column is clipped off-screen left,
  the right edge runs under the bezel. No max-width tied to viewport.
- Same root cause as F2/F6: surfaces/modals carry a desktop intrinsic width with no
  portrait budget. Where F2 was "almost-max-width shrink", this one doesn't even fit —
  the desktop width simply exceeds 100vw.
- Note: clubSelector already has a `@media (max-width: 620px)` block (clubSelector.css:138)
  yet still overflows — confirms the stopgap clamps chrome but not modal content grids.

### F7 — ⚠️ BLOCKER: oversized modal → horizontal-scroll trap, no way home (screenshot 7)

Context: closed the Join Club modal (F6). The whole view is now shifted left — only the
*right* half of the menubar (carat "0") is visible; home button + oshi selector are
off-screen left. Cannot close, interact with the trainer, or go home. **Unrecoverable
without a page reload.**

Observations (user commentary):
- **Coming out of the club broke the top menu bar** — "possibly because the club modal
  was centred."
- Mechanism (hypothesis): the modal was wider than `100vw` (F6), creating horizontal
  document overflow; the browser scrolled right to reveal the centred modal; on dismiss
  the page stayed scrolled, so viewport-anchored chrome that assumes left=0 is now pushed
  off-screen. Net: a one-way trip into a stuck state.
- Severity: this is the most serious finding. F4 corrupted projection state but left the
  home affordance to recover; F7 removes the recovery affordance itself. A non-technical
  user would be dead-ended (reload is the only escape, and they have no reason to know).

Root principle this exposes:
- **Portrait must forbid horizontal overflow, full stop.** No element may exceed `100vw`;
  persistent chrome must be pinned to the *viewport*, immune to any world/document
  horizontal scroll. (Generalises F6 → F7: oversize isn't just ugly, it's a trap.)

### F8 — Card detail surface confirms the overflow trap is systemic (screenshots 8–10)

Context: tapped a banner's support card → card detail surface (`cardSurface`, Air Groove
SSR: portrait, TYPE/BIRTHDAY/HEIGHT/THREE SIZES/RELEASED, NOTE, View on GameTora, Close).

Observations (user commentary):
- **"Escaped into a new viewport larger than my phone — I can navigate around it using
  the card surface."** The card detail is a desktop fixed-width modal wider than 100vw;
  with no overflow containment the whole document becomes a pannable oversized canvas.
  Same mechanism as F7 (clubSelector), now reproduced on a second, unrelated surface.
- Confirms T-E is **systemic**: it's not one bad modal, it's that *every* surface carries
  a desktop intrinsic width and the world/document has no `overflow` clamp. Any
  wide-enough surface re-triggers the trap.
- The **Close** button is itself off-screen right — even the escape hatch is unreachable
  without panning, compounding F7's "no way out".
- Timeline/minimap at the bottom of screenshot 10 looks structurally fine (the white
  "now" line + lens window render correctly) — minor T-C signal that the minimap, at
  least, survives portrait.

### F9 — Terminal trap state: chrome gone, stranded mid-world (screenshot 11)

Context: closed the card surface. Now stranded in the middle of an oversized world — **no
menubar (top), no minimap (bottom)** — navigation is purely dragging the timeline band.

Observations (user commentary):
- "Closing the card fully breaks the interface… no menu or timeline, stranded in the
  middle of the screen, navigation is purely dragging the timeline around."
- **Key diagnostic:** the chrome *disappeared* when the world panned. So menubar + minimap
  are NOT viewport-pinned — they're positioned relative to the world/document (or live
  inside the same transformed/scrolled container), so they scroll out of view with the
  band. This is *why* F7/F8 strand the user: there is no truly fixed escape affordance.
  → P0 fix is concrete: hoist persistent chrome out of the panned/transformed container
  and pin it to the visual viewport (`position: fixed` on a non-transformed ancestor).
- **T-C signal (the useful part):** the band itself renders *fine* in portrait — banner
  groups stack vertically, each = banner art + trainee/support chips + a carat-commit
  number on the right (Jun 18–27 group shown). The card *form* is legible; the failure is
  navigation/containment, not the representation. Suggests T-C may not need a wholly new
  timeline form — vertical-stacked banner groups already work; it needs containment +
  a thumb-driven way to move between them (minimap/scroll) rather than free-drag.

### F10 — Banner-group boxes spread wide and overlap (screenshot 12, live)

Context: live (horsetrader.site), containment fix deployed — app no longer dies. Dense
timeline region (~Jan 2027). The above-lane banner-group cards have dark `Canvas`
backgrounds (`.banner-group`) that extend well past their banner content and **overlap
adjacent groups** horizontally.

Observations (user commentary):
- "The containment boxes for the banners spread wide and overlap."
- `.banner-group { width: max-content; min-width: --timeline-card-w }` → a group is as
  wide as its widest lane. A group whose tall lane holds 2 banners is 2·card-w wide, so
  its single-banner lanes leave a wide empty dark box to the right — and neighbouring
  groups, nudged only by `packAbove` (which measures `getBoundingClientRect().width`),
  end up overlapping.
- CLASSIFIED: NOT browser-specific — **`z<1` specific**. Reproduces on Firefox (Gecko),
  Epiphany (WebKit) AND iOS Safari (WebKit); the earlier "fine on desktop" was Chrome
  tested at `z=1` (a full-height window needs no fit-zoom, so scale(z)=scale(1) and there's
  nothing to mis-measure). Short windows / portrait → fit-zoom OUT (`z<1`) → the bug bites.
- ROOT CAUSE (zoom + measurement): the timeline opens fitted, zoomed OUT (`z<1`). The
  packer measured card widths with `getBoundingClientRect`, which returns camera-
  `scale(z)`-transformed rects, while the collision boxes live in the unscaled content-axis
  space (`card.x`). The timeline forces `scale(1)` for the synchronous measurement window
  (timeline.ts `measuring ? 1 : z`) to make the rect read true geometry — but that
  unscale-then-read dance doesn't hold across engines (Blink honoured it at the tested
  z=1; Gecko/WebKit read z-scaled rects), so the packer got too-small widths and
  under-spaced the groups → overlap. At z=1 there's nothing to mis-read, hence Chrome fine.
- ⭐⭐ TRUE ROOT CAUSE (Gecko/WebKit only, ALL banner groups, every density — "WTF" box
  ≈ 2× banner with empty right half): I was measuring in headless **Chromium, the one
  engine where it WORKS** — so my "fixed" numbers were Blink's. The bug: `.banner-group`
  is `width: max-content` and the banner art is `<img width:100%>` with a **512px
  intrinsic** (CDP-confirmed naturalWidth=512 vs card-w 280). In a max-content pass a
  percentage width is indefinite, so Gecko/WebKit fall back to the image's 512px intrinsic
  → group box ~512, banner content 280, ~230px empty dark right half. Blink resolves the
  % to the flex basis, so Chrome never showed it. FIX: `.banner { width: var(--timeline-
  card-w) }` makes the banner *definite*, so the image's 100% resolves against 280, not
  512. (Kept `min-width: 0` too — pins against the secondary wide-atom-chip case.)
  bannerGroup.css. tsc clean, 271 pass. Chromium still hugs (no regression); Firefox/
  WebKit verification = user eyeball (can't repro in Blink, and FF BiDi automation not
  worth the detour).
- (earlier mis-diagnosis kept for the trail) thought it was a wide atom chip forcing the
  banner via `min-width:auto` (true but secondary), then packer spacing at z<1 (also real
  but secondary). The dominant cause is the image-intrinsic-under-max-content above.
- ⚠️ EMPIRICAL CORRECTION (headless Firefox repro, scratchpad/mctest.html): baked image
  dims **do NOT fix the max-content overflow**. Tested three banners in a `width:max-content`
  group: (A) `<img width:100% + width/height attrs>` → group ~512; (B) same, no attrs →
  ~512 (IDENTICAL to A); (C) element with definite `width:280px` → ~280 (hugs). A==B proves
  width/height attributes are presentational hints that `width:100%` overrides, so the image
  still contributes its 512 intrinsic to max-content. ⇒ The max-content fix is a DEFINITE
  container/element width (the CSS patch), full stop. Baked dims are complementary
  (layout-shift reservation + the broker abstraction), NOT this bug's cure. So the CSS
  `.banner { width: var(--timeline-card-w) }` patch must STAY; do not revert it.
- SECONDARY (separate, real): at z<1 the packer under-nudged via getBoundingClientRect →
  inter-card overlap. Independent of the box-width bug; fixed by the offsetWidth change.
- MEASURED EARLIER (Firefox): `.card.card--above` 296.8/274.99; card-w 17.5rem. Single
  card sized right — pointed me at spacing first (the secondary bug); the box-width
  primary bug needed the per-banner CDP dump to surface.
- FIX (DONE): packer measures with `offsetWidth`/`offsetHeight` (layout dims, transform-
  independent) instead of `getBoundingClientRect` — correct whether or not the unscale
  flushed, identical at z=1. app.ts packBelowLane + packAboveLane. tsc clean, 271 pass.
  PENDING VERIFY: hard-refresh Firefox/Epiphany (new bundle) to confirm overlap is gone.
- VERIFY GOTCHA: confirmed `--zoom: 0.5559` on a desktop Firefox window (z<1 on desktop too
  → bug is zoom-driven, not browser-specific ✓). BUT that region's ticks are 360px+ apart
  vs a 275px card → 85px gap with NO packing, so it doesn't exercise the packer. Must
  verify in a DENSE region (ticks < card-w, ~Jan 2027) where packAbove actually nudges.
- WATCH: setScene's cull arming (`culling.arm`) also measures inside the same unscale
  window via getBoundingClientRect — if the same Safari quirk bites it, the visible
  neighbourhood could mis-bound on portrait. Not yet observed; revisit if cards pop in/out
  wrongly on the phone.

### F3 — Carat counter number is tiny (screenshots 1–3)

The menubar carat balance ("0" pill, top-right) renders at a small font on phone — the
single most-glanced number on the screen is among the smallest text. Desktop sizing
carried over unscaled into the squished portrait menubar.

---

## Emerging threads (update as patterns repeat)

- **T-A: Surfaces need a portrait form, not a resize.** Commit to full-bleed (or an
  intended margin), one surface at a time — retire the left/right spatial split on
  phone (F2). And collapse the surface↔shield (read↔write) split into one scrollable
  sheet: on portrait there's no spatial context for a modal to preserve, so display and
  edit unfold together (F5). Both are the *same move* — portrait shows one full-bleed
  thing at a time, so the desktop's spatial multiplexing (left/right groups, floating
  shields) has nothing to multiplex and should dissolve.
- **T-B: Chrome is squeezed desktop, not re-typeset.** Menubar stacking + tiny carat
  number = the bar wasn't redesigned for portrait, just clamped. (F1, F3)
- **T-C: The timeline itself still needs a portrait representation.** (F1; unconfirmed
  what that form is.)
- **T-E: ⚠️ No horizontal overflow allowed; chrome pinned to viewport.** CONFIRMED
  SYSTEMIC (F6→F7 clubSelector, F8 cardSurface — two unrelated surfaces, same trap). Any
  element exceeding 100vw turns the document into a pannable oversized canvas and can
  strand the user with no reachable home *or* Close (F8's Close was off-screen too). Root
  cause: every surface carries a desktop intrinsic width AND the world/document has no
  horizontal `overflow` clamp. This is a *correctness/safety* invariant, not polish — the
  highest-priority fix. Two parts: (1) clamp document/world horizontal overflow so nothing
  escapes the viewport; (2) give surfaces a portrait width budget (≤100vw, the T-A
  one-sheet form). Persistent chrome must be viewport-pinned and always reachable.
- **T-D: Touch gestures aren't arbitrated.** Surface content can't scroll because the
  timeline pan captures every drag. Portrait needs gesture containment — a drag inside a
  surface scrolls the surface, only the bare world pans. (F4) Possibly the single most
  *broken* thing: it's not ugly, it's unusable + corrupts state (rogue pan = bogus
  projection).

---

## Synthesis & plan (derived from F1–F8)

### Keystone cause

The desktop idiom is **spatial multiplexing over a freely-pannable world**: the
timeline-world is effectively the document, surfaces float over it at desktop intrinsic
widths, and nothing clamps horizontal overflow or arbitrates touch. On portrait this
produces every finding:

- surfaces too wide for 100vw → overflow → pannable oversized canvas → **stuck, no way
  home/Close** (F6→F7, F8) — *safety*
- world pan captures every drag → surface content can't scroll, rogue pans corrupt the
  projection (F4) — *safety*
- left/right groups + read-surface/write-shield have no room to multiplex → accidental
  stacks (F2, F5) — *structural*
- chrome clamped but not re-typeset (tiny carat number) (F1, F3) — *polish*

So Godolphin's "swap decision" (read Darley's viewport facts; when the single
representation runs out, take over) lands concretely as: **on a portrait/touch viewport,
swap from "spatial-multiplex over a pannable world" to "one full-bleed sheet at a time
inside a hard-clamped viewport."**

### Plan, in severity order

1. **[P0 safety] Contain the viewport (T-E).** Clamp document/world horizontal overflow
   so nothing can escape 100vw; pin persistent chrome (menubar/home) to the viewport so
   it's always reachable regardless of world or modal scroll. Kills F7/F8's dead-ends.
2. **[P0 safety] Arbitrate touch gestures (T-D).** A drag inside a surface scrolls the
   surface; only a drag on the bare world pans it. Scroll containment + stop-propagation
   on surface roots ([[project_in_timeline_controls_pattern]]). Kills F4.
3. **[P1 structural] One portrait sheet at a time (T-A).** Give surfaces a portrait width
   budget (≤100vw, full-bleed or intended margin); dissolve the left/right group split
   and the surface↔shield modal split into a single scrollable sheet on phone (F2, F5,
   F6). This is also half of the T-E fix (no surface exceeds the viewport).
4. **[P1 structural — LARGELY ANSWERED by F9] Portrait timeline form (T-C).** Field data
   now points one way: the vertical-stacked banner-group band already renders legibly in
   portrait (F9) — the card *form* is fine; the failures were navigation + containment,
   not the representation. So T-C is **not a new timeline form**, it's: keep the band,
   add a thumb-driven way to move along it (scroll and/or minimap-drive) instead of
   free-drag, and let P0 containment stop it from straying. Restyle, not replace.
5. **[P2 polish] Re-typeset chrome for portrait (T-B).** Resize the carat number and
   menubar type for thumb/glance use rather than clamped desktop sizing (F1, F3).

### Open questions for the design call

- ~~T-C: what *is* the portrait timeline?~~ **Answered (F9):** keep the vertical band,
  make it thumb-navigable; restyle not replace.
- ~~Replacement vs restyle?~~ **Answered (F9):** restyle of the same DOM + containment +
  gesture work. Godolphin's "different representation" here is the *interaction model*
  (one-sheet, contained, thumb-driven), not a new visual band.
- Still open: **swap trigger** — width breakpoint, pointer-type (`any-pointer: coarse` /
  `hover: none`), or both? Darley's facts (`glassUnitPx`, `apertureHeightPx`) feed this.
- Still open: **how to move along the band** — native vertical scroll of the band,
  minimap-as-driver, or both? (the one remaining UX choice; everything else is mechanical)

### Build log

**P0-a — root overflow containment (T-E keystone). DONE + VERIFIED on device + desktop.**
Device re-test: card detail (Special Week) fully contained — Close visible, menubar +
minimap both present, no escape-pan. Desktop unaffected. Shipped live (deploy-nobake).
Diagnosis: `#app` (fixed, inset:0) and `.surface-layer` (fixed, inset:0) had no overflow
clamp; `body{overflow:hidden}` doesn't stop iOS from panning a fixed container when a
descendant overflows. So a too-wide modal → pannable region → whole chrome dragged
off-screen, unrecoverable (F7/F9); card surface "escape into oversized viewport" (F8).
Fix (CSS only): `overflow: clip` on `html`, `#app`, and `.surface-layer` (the last needed
separately because a fixed layer escapes #app's clip — clip is not a fixed containing
block). Overflow can no longer become a pan region; chrome stays pinned and reachable.
tsc clean, 271/271 tests pass. Files: css/base.css, surfaces/surface.css. NOT committed.
Next P0: T-D gesture arbitration (surface scroll vs world pan), once containment verified.

### Build log — image dimensions baked end-to-end (layout-shift hardening)

User's call: bake every image's dimensions so the FE can stamp width/height — "fix
the class at the source." Built end-to-end (NOTE: this is layout-shift/aspect-ratio
hardening + a clean image seam; it is NOT the max-content cure — that's the CSS fix,
which stays. See the empirical correction under F10.):
- ETL: `ImageRegistry` singleton (models/media/registry.py, mirrors Metrics) — Curren
  Chan records published-url → (w,h) on each `_process_one` publish (dims already cheap:
  `Image.process` reads webp headers, no regen). Eishin bakes `images.json`
  (ImagesBundle record + `Bake.images()` + pipeline wiring). 3393 images; banners 512×188.
  Value type is `list[int]` not `tuple` (tuple schema → `never[]` in json-schema-to-ts).
- FE: `ui/image.ts` broker — `img(src, opts)` builds `<img>` with width/height from the
  baked dims (graceful if absent). `initImages(images.dims)` in main.ts. Routed the 8
  baked-content, CSS-sized, previously-dimensionless sites through it: banner art, atom
  portrait, below-card mission + banner, card-surface art, commit-dossier art, filmstrip
  face, plan oshi. LEFT alone: static `/icons/*` and sites with deliberate display dims
  (oshiSelector 88, identitySurface 256×512) — broker'd intrinsic would override those.
- Verified (CDP, live dev server): banner `<img>` now `width=512 height=188`, renders at
  cssW=273 (CSS still controls display); atom portrait 128×128. tsc clean, 271/271 pass.
- Kept: `.banner { width; min-width:0 }` (max-content cure), app.ts packer `offsetWidth`
  (z<1 spacing). Not committed.

### Status: field study complete

11 screenshots, F1–F9, 5 threads. Plan is lockable. Two P0 safety fixes (containment +
gesture arbitration) are unblocked and independent of any remaining choice; the band is
a restyle; only the swap-trigger and band-scroll mechanism remain as small UX picks.
