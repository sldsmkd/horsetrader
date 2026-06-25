# Grand Masters — contracts and boundaries

> The sire metaphors (Byerley / Darley / Godolphin) were a **reasoning scaffold**: a set
> of higher-order concepts that let us shape this layer without low-level expertise. They
> did their job — they landed the right shape. This document is the scaffold **hardened
> into contracts**: each boundary stated concretely, assigned an owner, pointed at the code
> that enforces it, and (where it matters) backed by an executable guard so a later "tidy"
> can't quietly dissolve it. Read this before touching the glass/world/camera layer; extend
> it when a new invariant is discovered.
>
> The discovery occasion (a Godolphin field finding, a perf pass) is **provenance**, not the
> rule. A contract holds on every device, including the one where it never visibly bit.

## The spine: membership (Byerley)

Every visual element is exactly one of two kinds. This is the cut everything else hangs off.

- **GLASS** — fixed coordinates, orthographic, measures in `--glass-u`, mounted as a sibling
  of the world (the menubar, minimap, surfaces, scenario wallpaper). Size **is** dimension;
  it never uses `transform: scale`.
- **WORLD** — lives inside `.timeline__content`, moves under the camera transform
  (`translate · scale(z)`). Camera-scaled world units; deliberately **excluded** from
  `--glass-u`.

There is no third kind. Most contracts below are a consequence of which side of this line a
thing sits on.

### The optical model (why several contracts are one thing)

The world is a **parallel plane behind the glass**, viewed head-on through a pinhole whose
near window is the **aperture** (the viewable extent of the glass plane, C-D1). A
fronto-parallel plane through a pinhole has every point at one depth, so there is no
differential foreshortening — the projection is a *uniform* scale, exactly. That is why
`scale(z)` is a legitimate camera at all; the frustum reframe only promotes it from
*emulation* to the *literal* model: `scale(z)` is the **render** of the projection, not the
primitive. The primitive is a camera at depth `d` with `z = f/d`.

This makes three contracts faces of one model rather than independent rules:

- **Zoom (C-D3)** — the frustum's footprint on the plane is `viewport / z` in world units, so
  the visible world rect *is* zoom; they are one quantity. `zFit = aperture / worldExtent` is
  already a footprint computation in scale clothing.
- **Culling (C-B6)** — the correct cull is "what falls inside the frustum footprint." The
  horizontal half is already built (`reconcile`'s window uses `clientWidth / z` = the footprint
  width). The frustum reframe completes it: add the vertical axis, and take card bounds from the
  packer's known world coords instead of `arm`'s screen-rect round-trip — which is the same gap
  as C-B6's contained exception, dissolved by construction.
- **Aperture (C-D1)** — the near window the other two are derived through.

Held loosely as a *model*, not a build task; recorded because the frustum direction (C-B6
exception) is really an instance of it.

---

## Byerley contracts — abstract glass discipline (pixel-free)

**C-B1 · Membership is declared, not incidental.** Glass vs world is the sibling/child split
above (`surface-layer` + chrome are glass siblings; `.timeline__content` children are world).
Adding an element means choosing a side explicitly.

**C-B2 · Depth is one declared ladder; no raw z-index.** Glass paint order rides the
`--glass-z-*` tokens (`css/glass.css`: `wallpaper -100 · world 0 · surface 1 · chrome 3 ·
modal 1000 · alert 1100`). The world plane has its own single declared stacking constant,
`BELOW_LANE_STACK_TOP` (`timeline/constants.ts`), deliberately outside the glass ladder. No
other magic z-index may exist.

**C-B3 · Modality is a lock on the spawn tree; there is no "shield" type.** One `surface()`
type wears orthogonal traits — *modal-demand* (emits the lock up its spawn lineage to the
menubar, which fans it down its subtree) and *placement* (centred/anchored/placed).
Navigation is exempt by sibling geometry, not special-case. Visibility ≠ interactivity. See
[byerley-turk.md](byerley-turk.md) "Modality is the third axis".

**C-B4 · Glass resizes dimensionally, never by transform.** Glass surfaces are `N ×
--glass-u`; `transform: scale`/`zoom` on glass is a projection violation (parallel ⇒ size is
dimension). `scale` is the camera's privilege, world plane only.
*Guard:* none yet (candidate — assert no `scale(`/`zoom` under glass CSS).

**C-B5 · Containment — the planes clip to the viewport box; overflow is never a pan region.**
Both the world (`#app`) and the glass surface layer (`.surface-layer`), plus the document
root (`html`), carry `overflow: clip`. A descendant wider than the viewport (an oversized
modal) is **clipped**, never allowed to turn the document into a pannable canvas that drags
the viewport-pinned chrome off-screen. `.surface-layer` needs its own clip because it is
`position: fixed` and `clip` is not a fixed containing block, so it escapes `#app`'s clip.
This is the *outer* completion of Byerley deliverable #4 ("containment as payoff") — #4
addressed internal glass overlap; C-B5 is the viewport boundary. *Enforced:* `css/base.css`
(html, #app), `surface.css` (.surface-layer). *Guard:* `containment.test.ts`. *Provenance:*
Godolphin F7/F9.

**C-B6 · World geometry read for layout is transform-independent.** Because world content is
camera-`scale(z)`-transformed (C-B1), any measurement feeding *content-space* layout must use
transform-independent dimensions (`offsetWidth`/`offsetHeight`/`offsetLeft`), never
`getBoundingClientRect` (which returns the camera-scaled screen rect). The measurement window
forces `scale(1)`, but that synchronous write is not reliably flushed before the read on iOS
Safari, so the rect can still be z-scaled. *Enforced:* `app.ts` packer (`packBelowLane`,
`packAboveLane`). *Guard:* `cameraMeasure.test.ts`. *Provenance:* Godolphin F10.
- **Known exception (contained, not yet fixed):** `culling.arm` (`culling.ts`) still reads
  `getBoundingClientRect` to measure each card's content-space *left/right*. It measures
  *position*, not size, so the offset-based equivalent depends on the offsetParent frame; the
  failure (mis-windowed cull → wrong pop-in/out) is **unobserved** to date. Flagged here so it
  is a named, reasoned exception rather than a silent latent violation; fix gated on a real
  device repro (verify on the LAN iPhone), not a blind swap.
  - **Intended resolution = the frustum reframe, not an offset swap.** Culling is already a
    world-space subsystem (`reconcile` is camera-agnostic arithmetic against precomputed
    bounds); the only screen-space round-trip left is `arm` *re-deriving* world bounds from a
    DOM rect, as if the card's world position were unknown. But the packer already **computes**
    it (`card.x`, lane depths, per-card heights). When culling takes its bounds from that known
    layout data and tests them against the **camera frustum** — the aperture (C-D1) projected
    through the camera conversion into a world rect `[screenToContentX(0), …W] ×
    [screenToContentY(0), …H]` — there is no rect to measure, so C-B6's exception *ceases to
    exist* rather than being patched. Bonus: the frustum is 2D + zoom-aware, retiring today's
    "blind x" (no vertical cull) — which matters as vertical pan/zoom grow, and especially
    under Godolphin's landscape rotation (the long axis becomes vertical in screen terms).
    Owner seam: the frustum is Darley's aperture projected into world space, consumed by the
    world-plane culler. Not scheduled; recorded so the exception reads as a placeholder.

---

## Darley contracts — screen-space px mapping (the one place abstraction meets hardware)

**C-D1 · The view is the usable aperture, not the raw rectangle.** "What can be displayed" =
viewport − persistent chrome reservation, resolved as `--glass-aperture-h` (`css/base.css`).
A literal rectangle that gives the camera an honest height to fit into — not a renderer (no
occlusion/visibility negotiation).

**C-D2 · `--glass-u` is height-led, width-vetoed, px-clamped.** `--glass-u-base: clamp(7px,
min(1svh, 2svw), 20px)` (`css/glass.css`). Height is the sole scale axis; the width term only
*vetoes* (catches narrow-tall phones); `svh`/`svw`, never `dvh` (dvh reflows as the mobile
toolbar slides). `--glass-u: var(--glass-u-base)` is the local surface unit (rail dropdown
overrides it locally to shrink dimensionally). floor/ceiling are calibrated product limits.

**C-D3 · `zMin` is derived; `zMax` is feel.** `zFit = apertureHeightPx() / world-vertical-
extent`; `zMin = max(Z_FIT_FLOOR, min(Z_MIN_BASE, zFit))` (`timeline.ts setContentDepth`) —
the screen-space fit only *deepens* the eye-tuned baseline on cramped displays. `zMax`
("how readable", not "what fits") stays eye-tuned. Pan bounds already read the viewport live.

**C-D4 · The rail extent is one physical quantity, shared by paint and gesture.** The home
rail's screen-fixed extent feeds both the CSS visual (`--timeline-rail-height`, glass-u) and
the JS derail/capture math, resolved through the glass-u→px bridge (`glassUnit.ts`
`resolveLengthPx`). They must originate from the same resolved measure or the visual rail and
the "where a shove derails" boundary drift apart. *Guard:* `railSeam.test.ts` (the precedent
for this whole document).

**C-D5 · Material/perf budget is a policy in one knob.** `--glass-blur` is centralised so the
blur decision lives in one place. *Verdict (UmaMark):* keep always-on frost — its own cost is
negligible (desktop free; iPhone ~1ms). Worst-case fast-pan fillrate accepted; pooling parked.

---

## The feel axis — owned by no sire; it just stays

Pan momentum, spring/rubber, derail **bias** + grip falloff, return speeds, and the eye-tuned
zoom **range** (incl. `zMax`) are a *what-feels-right* axis tuned by hand against sensation —
not a pixel scale, not display-relative. Nothing to derive or re-home; leave it untouched.
The **only** place feel touches screen-space is the rail extent (C-D4).

---

## The Godolphin seam — what Part 3 is allowed to build (held loosely)

Godolphin owns **modality-as-orientation**: the device-agnostic capability+policy substrate
that wires the rotation transform and the input-frame. It **consumes capability** (reliable,
feature-detectable: can-portrait / coarse-pointer / orientation-present) to set policy.

**Surfaces have a dual representation — portrait and landscape — and policy owns the cutoff**
(the core Godolphin abstraction, 2026-06-24). A surface like the card detail isn't "a thing
that rotates"; it declares two forms (`{ portrait, landscape }` — e.g. the wide card modal vs
the tall card sheet) and the cutoff between them is ours. Everything else (capability, the
keyboard reconcile below) is an *input to the cutoff*, not separate machinery.
- **Representation ⊥ rotation.** The *representation* is the content/layout. The *rotation* is
  only the transform that fits a chosen representation onto a viewport whose natural shape
  disagrees — showing the landscape-rep on a phone's portrait-shaped DOM viewport needs the 90°
  CSS-rotate to map the long DOM axis to the visual horizontal. Cutoff picks the representation;
  viewport shape decides whether a rotation bridges it.
- **Desktop is the identity config (again):** it only ever lands on the landscape-rep, and its
  viewport already matches, so no rotation ever fires. Same dual-rep surface; the bridge is just
  never exercised. No `if (isPhone)`.

**Touch ergonomics — a capability axis orthogonal to the orientation cutoff** (Godolphin,
2026-06-24). Making icons hittable with fat thumbs keys off `coarse pointer` (+ `maxTouchPoints`,
`any-hover: none`), NOT orientation — a landscape *phone* still needs thumb-sized targets, so it
cuts across both representations. Mechanism: enforce a touch-target minimum (44 CSS px / Apple
HIG, 48dp / Material), expand hit-areas beyond the visual icon, swap hover-only affordances for
tap. Darley supplies the px facts; Godolphin consumes the pointer capability to drive it.

**Physical device size is NOT derivable — and not needed.** Physical PPI is not exposed (privacy),
and CSS px is *angular*, not physical, so `CSS-px / 96` lies on phones (F11: iPhone reads 390 CSS
px wide but is ~2.8″ ≈ 138 CSS-px/in, not 96 — off by 45%). There is no first-principles path to
inches. Both jobs "size" would serve are better served without it: **touch sizing** uses CSS px
directly (already angular-normalised → 44 CSS px is the right physical size everywhere), keyed on
`coarse pointer`; **device class** (phone/tablet/desktop) falls out of **CSS-px viewport extent +
pointer** (iPad = coarse+large, phone = coarse+small, desktop = fine). A true inch estimate, if
ever wanted, is a fuzzy resolution-fingerprint / `userAgentData.model` heuristic (iOS gives no
model) — don't build on it.

**We own rotation for display — until a keyboard is summoned, where we defer to the device**
(decided 2026-06-24, F11). By default we drive rotation (mode→orientation: app picks, user
turns to match), and owning the CSS rotation works straight through OS rotation-lock for all
*our* surfaces. The **one exception is the on-screen keyboard**: the OS renders it in
`screen.orientation`, an orientation we cannot rotate ourselves. So when text input is invoked
we must reconcile to the device:
- **Reconcile-on-text-input:** read `screen.orientation`; set our presented orientation to match
  it *before/as* the keyboard rises. Concrete case — editing the card NOTE over a forced-landscape
  world on a **portrait-locked** device (held sideways): the OS keyboard would slide up sideways →
  **rotate the world to portrait**, then the keyboard rises aligned. If the device already
  **reports landscape** → keyboard aligns → **no action.** The keyboard can appear in *any* mode
  (timeline search, card NOTE), so this is not scoped to the forms sheet. Reverse on blur/close.
- **iOS sequencing constraint (load-bearing):** iOS only raises the keyboard if `focus()` runs
  *inside the user gesture*. So we **cannot** "animate rotation, then `focus()` on animation-end"
  — that focus lands outside the gesture stack and iOS shows no keyboard. Instead, in the *same
  synchronous tap handler*, flip the orientation state to portrait (CSS transform begins
  animating) **and** call `focus()`. The OS keyboard rises in `screen.orientation` while our world
  rotates to match — they co-animate and converge, rotation leading. "Rotate before the keyboard"
  is really "rotate *with* it, triggered in one gesture." (The reverse rotation on blur has no
  focus, so it's an unconstrained transform.)
- **So `screen.orientation` IS consumed** — but only to reconcile rotation with the OS keyboard,
  not to drive mode selection. Motion sensors (`DeviceOrientationEvent`/gravity, https +
  permission-gated) stay dropped: their extra (true hold under lock) is still irrelevant —
  what matters is where the OS will *put the keyboard*, which is exactly `screen.orientation`.
- **Then `visualViewport` does its separate job:** once oriented, its `.height` shrink is the
  cross-engine keyboard-size detector (iOS overlays → only `visualViewport` sees it; Android may
  resize the layout viewport, also caught) → reflow to keep the focused input above the keyboard.
- **Keep it out of the sizing unit.** `--glass-u` stays `svh` — stable, deliberately not
  reflowing as toolbars/keyboard slide (C-D2). The `visualViewport` read is a separate dynamic
  consumer; do not let its dynamism leak into the unit. Desktop is the **identity
configuration** of the same controller (portrait declined → rotation/input-frame are no-ops) —
not an `if (isPhone)` branch. It may not redefine any contract above; it grounds *on top* of
them, which is why they are locked down first. Full direction:
[godolphin-findings.md](godolphin-findings.md) "Design direction".

---

## Guard status

| Contract | Enforced in | Executable guard |
| --- | --- | --- |
| C-B5 containment | base.css, surface.css | `containment.test.ts` |
| C-B6 camera-measure | app.ts packer | `cameraMeasure.test.ts` |
| C-D4 rail seam | timeline.css/.ts, glassUnit.ts | `railSeam.test.ts` |
| Godolphin capability substrate | caps/capabilities.ts | `caps/capabilities.test.ts` |
| C-B4 dimensional | glass CSS | *candidate* (no-scale-on-glass) |
| C-B2/B3/D1/D2/D3 | as cited | covered by prose + tsc; no guard yet |
