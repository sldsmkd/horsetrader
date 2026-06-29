# Darley Arabian — Part 2: bravery

> The second AI. Where Byerley lives in an idealised, unit-relative orthographic
> order, Darley **faces the messy reality of actual hardware** — real pixels, real
> viewports, the range of displays we don't control. She grounds the abstraction.

Project frame and shared grounding: [grand-masters.md](grand-masters.md). Builds on
[byerley-turk.md](byerley-turk.md) (the glass plane + unit must exist first).

## Thesis

Byerley's order is correct *relative to* `--glass-u` and deliberately never touches a
pixel. Darley owns the one place where that abstraction meets a real device: she
**defines the view, maps it, and decides what can be displayed**. She owns px and
scale. Bravery is the right register — Byerley gets the clean room; Darley walks out
into the wild range of actual screens.

Still **one representation.** Darley maps Byerley's single coherent glass onto any
display honestly; she does not swap in a *different* representation when a display is
too far out — that is Godolphin.

## What building Byerley changed (the re-cut)

Byerley's abstract-first work paid out larger than scoped, and it **shrinks Darley to
something surgical**, not a grounding sweep. The as-built that reshaped this brief:

- **The shim is already a viewport unit.** `--glass-u-device-calibration: 1vh`
  ([css/glass.css](../horsetrader.site/css/glass.css)) means the whole glass plane is
  *already* responsive through the comfortable middle of the display range — which is
  why the site became near-fully usable on a phone before Godolphin (Part 3) started.
  Darley does not *make it responsive*; she makes the naive single-axis map **honest at
  the extremes** (where pure `1vh` lies) and derives the limits.
- **The "one knob" is real.** [css/base.css](../horsetrader.site/css/base.css) routes
  the entire chrome tier through `--glass-u-device-calibration`. So "resolve `--glass-u` to px" is now
  literally **one `:root` expression swap**, not a sweep.
- **The camera already reads the viewport live.** `panBounds` / `panBoundsY` read
  `clientWidth` / `clientHeight` each call
  ([timeline.ts](../horsetrader.site/js/src/ui/views/timeline.ts)); the vertical well
  already scales off a base range by `z`. The only un-derived camera numbers are the two
  zoom constants. So "responsive limits" is far narrower than the original brief implied.

### The cut: screen-space vs feel (load-bearing)

Two different *kinds* of quantity hide inside "the physics," and Darley owns exactly one:

- **Feel / behaviour** — how fast a fling travels, how sticky the surface is, how hard you
  shove to derail, how the rubber band pulls back (pan momentum, spring/rubber, derail
  *bias*, grip falloff, return speeds, the eye-tuned zoom *range*). This is a *what-feels-
  right* axis, tuned by hand against sensation — **not against a pixel scale**. It isn't
  display-relative, so there's nothing here for Darley to reproduce or re-derive; she simply
  leaves it untouched.
- **Screen-space** — the glass-u px, `zMin` / fit-to-height, the home-rail's screen-fixed
  extent: how big things are and how much fits on a real display. This *is* Darley's.

They're orthogonal, which is what makes the cut clean. For the screen-space derivations the
only constraint is that they land where things currently sit (the known-good sizing on the
dev machine — a sanity check, not a target Darley owns). The feel axis she doesn't touch at
all. **The one place the two touch is the home-rail** (deliverable #4): a feel threshold —
how far a shove derails — is measured geometrically against a screen-space extent (the rail's
height), so that single px derivation has to carry the gesture math with it.

## One mapping, not five tasks

The deliverables aren't five independent jobs — they're stages of a single projection
pipeline, each consuming the one above. The *authoritative view description* (deliverable
#1) is the artifact that holds the chain:

    real display / raw viewport
      → glass-u calibration (the unit, in px)            [#2]
      → usable world aperture (viewport − chrome)        [#1]
      → camera fit / zMin (fit world into aperture)      [#3]
      → screen-fixed interaction extents (the rail)      [#4]
      → hardware-appropriate material budget (blur)      [#5]

Compact thesis: **given this device and viewport, establish the lawful screen-space
mapping shared by glass, camera, and screen-fixed interaction geometry.** Byerley made
every downstream consumer listen to one unit; Darley computes that unit and exposes the
resulting view consistently.

## Deliverables (firm)

1. **Define the view — the usable aperture, not the raw rectangle.** The authoritative
   description of the display surface and how much of the *world* it can actually show — the
   single source the system reads "what can be displayed" from. The load-bearing distinction:
   this is **not** synonymous with raw `clientWidth/clientHeight`. The camera frames world
   into the **aperture through the glass** — the viewport minus the persistent chrome
   reservation the menubar/minimap already carve out (base.css `--main-content-h`). Today the
   JS camera reads the raw rect while the CSS already reserves chrome; naming the aperture
   closes that latent gap and gives #3 the right input. Keep it the *one* distinction worth
   making now (viewport vs aperture, via the chrome reservation that already exists);
   safe-area insets and the visual viewport are real future reservations *of the same kind*,
   but recording them as fields waits until something needs them — don't over-model ahead of
   need. (Recording an inset is Darley; *reflowing* to it is Godolphin.) And keep aperture
   *literally* a rectangle (viewport − chrome reservation) — it is a high-level framing
   concept, **not** the first step of a camera model. No per-surface visibility, no occlusion
   negotiation; we are not building a renderer (no BVH / ambient occlusion / GI). The
   aperture's whole job is to give #3 an honest height to fit into.

2. **Resolve `--glass-u` to pixels — one honest expression.** Replace the `1vh` shim with a
   height-authoritative, width-*vetoed*, px-clamped unit — the Unity CanvasScaler "match-height
   with clamp" idiom: `clamp(floor, min(Kh·1svh, Kw·1svw), ceiling)`.
   - **Height is the sole scale axis** (the timeline well is height-bounded). The width term
     does *not* make width co-authoritative — it only **vetoes** a result that can't fit,
     catching narrow-tall phones where pure height balloons surfaces past the width.
   - **Stable viewport unit, not `vh`/`dvh`.** `dvh` reflows the whole UI as the mobile
     toolbar slides (every surface breathing while the URL bar animates) — wrong for a
     dimensional *unit*. Use the calmer `svh`/`svw`.
   - `floor`/`ceiling` are **calibrated product limits**, not generic "best practice".
   - **Testable reference condition:** at the dev aperture the expression resolves to today's
     effective unit within an agreed tolerance — protecting the eye-tuned application while
     letting the function bend at the extremes. *(Exact numbers deferred.)*

3. **Derive `zMin` only; `zMax` stays feel.** The cut is **screen-space vs feel** — Darley's
   mandate restated. The camera's *pan* bounds are already viewport-derived — leave them.
   `zMin` / fit-to-height is a **screen-space property**, so phrase the derivation in
   world/camera language, not display class: `zFit = available world-aperture height /
   required world vertical extent`, `zMin = bounded(zFit)`. The meaningful input is the actual
   vertical **aperture** (after browser + glass frame take their share — #1), never a nominal
   "1440p". The dev display is only the anchor asserting the result lands near today's `~0.6`;
   the formula is *not* a 1440p ratio, and zMin is free to differ elsewhere — adapting to the
   display is the *point*. (Open impl detail, not a design call: the world vertical extent
   packs dynamically, so decide which extent — representative / max — feeds `zFit`.) `zMax`
   (how close the trainer may bring the model railway — "how readable?", not "what fits?") is
   **feel** and stays eye-tuned, untouched.

4. **The camera-meets-display seam — expose glass-u to JS (handed over from Byerley).**
   Byerley surfaced the concrete instance and **deliberately left it for Darley** rather
   than half-do it with the shim: `TRACK_RAIL_VISUAL_PX` is one screen-px constant feeding
   *both* the CSS visual (`--timeline-rail-height`, set inline in timeline.ts) *and* the JS
   derail-gesture math (`TRACK_DERAIL_PX + TRACK_RAIL_VISUAL_PX / 2`). The rail isn't a
   painted band — its extent **is** the capture/derail geometry the gesture state machine
   measures against, so extent and threshold are the *same physical quantity*; split across
   two unit systems the visual rail and the "where a vertical shove derails" boundary drift
   apart. The seam's mechanism: make the **glass-u→px bridge readable from JS**, so the
   screen-fixed rail extent moves to glass-u and resolves to px in the gesture layer as one
   coupled change. Move the CSS visual and the JS feel value together or they desync. Make the
   coupling **executable**, not prose: the rail half-height CSS paints and the capture/derail
   boundary JS measures must originate from the *same resolved measure* (read the resolved
   custom property at the correct root, refreshed when the view changes) — an assertion/test
   so a later "tidy" can't quietly fold one side back into a convenient constant. Reading
   computed style is legitimate here precisely because this *is* the CSS-to-device calibration
   bridge, not business logic scraping presentation.

5. **The display / perf budget — a policy, not a verdict.** "Faces real hardware" is
   performance reality, not only pixel reality, and blur cost scales with the *pixels
   repeatedly composited*, not the mere existence of glass. Byerley parked `--glass-blur`
   (`backdrop-filter` re-rasterizes the live timeline every frame — brutal on mobile GPU).
   Darley leaves behind a *policy* the token centralises: a default material path, a
   constrained-hardware path, an opaque / non-blurred fallback, and a small benchmark scenario
   + acceptable frame budget. The likely outcome is brutally simple — drop blur below some
   capability, or *while the world is moving* (the worst case is exactly pan/zoom) — but the
   decision stays in one place.

## Non-goals (the seam to the other sires)

- **The abstract structure.** The glass plane, membership, depth ladder, and dimensional
  discipline are **Byerley's**. Darley grounds them in px; she does not redefine them.
- **Feel / behaviour — not Darley's.** Pan momentum, spring/rubber, the derail *bias* and
  grip falloff, return speeds, and the eye-tuned zoom *range* are a *what-feels-right* axis,
  tuned by hand against sensation — not a pixel scale, not display-relative. Nothing to
  derive; Darley leaves them untouched. (The rail's screen-fixed *extent* is the one place
  feel and screen-space touch — the extent itself is screen-space, so it's hers: #4.)
- **The world mission-plane cards.** `bannerGroup` / `belowCard` / `card` stay camera-scaled
  world units; migrating them to a viewport unit would fight the camera. Byerley's deliberate
  exclusion, not a Darley seam.
- **Alternate representations.** Phone reflow / touch / widget reshaping — a *different*
  representation when one mapping won't serve — is **Godolphin's**. Because Byerley's
  single mapping already reaches phones, Darley should push the *single* representation to
  cover as much of the device range as it honestly can, deliberately keeping Godolphin's
  scope to genuine alternate-representation work (touch ergonomics, reshaped surfaces)
  rather than "make it fit." The line moved toward Darley; don't let Part 3 re-annex it.

## Provenance

Absorbs the "responsive zoom limits on small / narrow viewports" strand of the
parked "Floating timeline chrome + mobile" project
([../debut/parked.md](../debut/parked.md)), plus the px-derivation handed forward from
Byerley's glass unit. Re-cut 2026-06-20 against Byerley's as-built (handoff:
[byerley-outstanding.md](byerley-outstanding.md)) — the abstract-first win shrank the
job and surfaced the screen-space vs feel cut.
