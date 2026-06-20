# Byerley Turk — Part 1: order and discipline

> The first AI. Imposes **order** on the chrome we floated but left with blast
> damage, and **discipline** on geometry we faked. Delivers the disciplined glass
> substrate the other two sires build on.

Project frame and shared grounding: [grand-masters.md](grand-masters.md).

## Thesis

There is one coherent orthographic glass system. Byerley names it, gives it a single
honest unit, declares its planes and depth, and removes the projection violations
(`scale` on glass) that have been patched per-component. The payoff — the chrome
stops colliding with the timeline, the dropdown spacing stops lying — is a
*consequence* of the structure, not a pile of point fixes.

## Deliverables (firm)

1. **Name and formalise the glass plane.** Make the three implicit axes explicit:
   - **Membership** — a declared distinction between glass elements (fixed coords,
     orthographic, share the glass unit) and world elements (inside `content`,
     camera-transformed). Today this is only "sibling vs child of `content`".
   - **Depth** — one declared back→front ladder (`wallpaper · world · surfaces`)
     replacing the current mix of mount-order + scattered `z-index`. One honest
     glass-surface band, stacked by spawn order. Depth is orthogonal to membership.
     (The old `shields` / `lifted-chrome` "bands" were never depth — `shields` is the
     *modal trait* and `lifted-chrome` is "spawned-late paints-above"; both move to the
     modality axis below.)
   - **Modality** — a third axis orthogonal to the other two, enforced by a **lock**
     (not by stacking): when a surface demands exclusivity, a lock travels up its spawn
     lineage to the menubar (the spawn-tree root) and fans back down the subtree, so the
     whole surface plane goes inert while staying *visible*. Navigation is a sibling of
     the menubar, so the lock never reaches it. See the modality section below — and note
     this dissolves the "shield" type into a surface trait.

2. **The glass unit — as an abstraction.** Establish that every glass surface measures
   in a single dimensional unit `--glass-u` (instead of per-component `rem` / `vw` /
   `scale` guesses), and that glass resizes **dimensionally** (size = dimension), never
   via `transform`. Byerley owns the unit's **discipline**, not its pixel derivation:
   it ships a *naive placeholder* (`--glass-u` ≈ a simple `vh`) only so surfaces have
   something to build against, and **hands the real viewport→px mapping — fix-height/
   derive-width, `vmin`/`clamp()`, ultrawide + small-screen guards, responsive zoom
   limits — forward to Darley** (her boundary: px and scale). Resolution-independence is
   *structural* here (everything is N × `--glass-u`); making it true on real hardware is
   Darley's job. See [darley-arabian.md](darley-arabian.md).

3. **Honest glass geometry.** Retire `transform: scale` from glass surfaces (starting
   with `--chrome-dropdown-scale`). `scale` is the camera's privilege on the world
   plane only; glass is parallel, so size = dimension and the layout box must equal
   the render. The scale-jank
   ([done.md](../debut/done.md) — "transform shrinks render not layout box") dies as a
   consequence.

4. **Containment as payoff.** With membership + depth declared and geometry honest,
   the "blast-damage containment" (overlap with timeline cards, scenario art, the
   bottom minimap) becomes systemic: elements on one declared plane at known depths,
   not scattered siblings with ad-hoc geometry. Replace the per-fix patches with the
   plane rules.

## The glass register (settled — Byerley owns it)

The holographic visual language of the panes (transparency, edge-light, projection
feel) is **Byerley's, shipped as a real ordered token layer** — not a placeholder.
Rationale: it is order on the token layer; the holographic feel is the glass's honest
*identity*, not incidental skin; and no later sire's altitude is "theme" (Darley is
px/viewport, Godolphin is device-forms), so deferring it would leave it homeless. It
stays inside Byerley's pixel-free room because the register trades in colour and unit,
not px-mapping.

A future **re-theme** (a different visual skin over the same vocabulary) is a separate,
orthogonal concern — *not* one of the three sires. If it ever happens it negotiates
**with** Byerley's token layer; it is not part of Part 1.

## Modality is the third axis — and there are no shields (settled)

The "chrome-vs-shield depth" question was the wrong question. It assumed *depth* decides
whether a modal can reach the menubar/minimap. It doesn't. **Modality is a third axis,
orthogonal to membership and depth** (membership ⊥ depth ⊥ modality), and it's enforced
by a **lock**, not by stacking. The menubar in the screenshot stays painted on top and
fully visible while a centred modal is open — it is simply *locked*, inert. Visibility ≠
interactivity, so we never had to choose "chrome above" vs "shield covers chrome."

### The lock is a spawn-tree message

Glass surfaces form a **spawn tree** whose paint depth is independent of its spawn shape:

```
glass plane            ← mount root (inert; never participates in the lock)
├── menubar            ← top of the SPAWN lineage; spawns surfaces
│   ├── trainer surface → oshi picker (modal) → [alert (modal)]
│   └── resource surface
└── navigation/minimap ← SIBLING of the menubar, mounted directly; spawns nothing
```

A surface that demands exclusivity emits a lock **up its spawn lineage**; each node
locks itself and **fans the lock down to its own children**. The up-traversal terminates
at the **menubar** (top of the spawn lineage — nothing spawned it), and the down-fan then
covers exactly the menubar's subtree. So a modal born at any leaf locks the *whole surface
plane* in one sweep — including siblings it shares no direct edge with (the resource
surface), reached via the common spawn root.

- **Navigation is exempt structurally, not by special-case.** It is a *sibling* of the
  menubar, not a descendant; the lock's up-traversal stops at the menubar and only fans
  down its subtree, so it never crosses into navigation. (It also can't spawn surfaces and
  is a world-plane affordance — but the *mechanism* is sibling geometry, not a rule.)
- **Each node owns its own lock state**, so nested modals and partial unlock work: when an
  **alert** (a modal one level deeper) releases, its parent does not re-broadcast upward —
  it is still itself locked while open. Unlock otherwise propagates the same way as lock;
  closing a surface is an innate unlock.
- The down-fan is **general** (any locking node fans to its children); the tree is just
  shallow enough today that only the menubar exercises its breadth.

### There are no shields — only surfaces with traits

The collapse this licenses: **"shield" is not a type.** There is one surface type, and
"shield" was a surface wearing two *independent, orthogonal* traits:

- **Modal demand** — on spawn, claim exclusivity and emit the lock. The *only* thing the
  lock machinery reacts to. An **alert** is the same trait, one level deeper — also not a
  type.
- **Placement** — a hint (centred / anchored-to-spawner / placed). A centred modal and a
  pinned dropdown differ only here; placement has nothing to do with the lock.

| was called | really is |
| --- | --- |
| shield | surface · modal · centred |
| alert | surface · modal · centred, spawned by a modal surface |
| dropdown / menu | surface · non-modal · anchored |
| trainer / resource surface | surface · non-modal · placed |

This is Byerley's mandate in action — it deletes a *faked category* the way the geometry
work deletes a *faked transform*. The old depth ladder's `shields` and `lifted-chrome`
bands were never real depth: they were this modal trait plus "spawned-late paints-above"
masquerading as stacking. Depth stays one honest paint-order axis; modality rides a trait
on a surface.

The shield-vs-unfold design *heuristic* — split a read surface from a write surface only
when display ≠ edit — survives unchanged; it is reworded from "instantiate a Shield" to
"spawn a second surface that requests the modal trait."

## Parked decision — register backdrop blur (benchmark before locking)

The glass register's `--glass-blur` (`backdrop-filter`) frosts every pane over the live
timeline. It looks right and is the holographic point, so it **stays in** — but it is an
**active, un-settled decision**, not a default: the blur re-rasterizes the moving world
every frame and is brutal on CPU/GPU, especially on mobile. It must be **benchmarked**
before it's locked, and may need a perf budget, a reduced radius, or an opaque-fallback
path. The revisit belongs to **Darley** (hardware reality) + **Godolphin** (mobile); the
token is the single knob that turns it down or off. (Shipped 2026-06-20 as built-but-parked.)

## Bridging shim (Darley-stand-in — delete-on-Darley)

Byerley's `--glass-u` is unit-relative and pixel-free; the px resolution is **Darley's**,
and Darley isn't built. So Byerley ships a **naive shim** in her place — just enough px
mapping that surfaces measured in `--glass-u` actually render, calibrated to the dev
desktop and nothing braver.

- **Authoritative axis = height** (Darley's plan: the timeline well is height-bounded).
  Calibration sample (MANGOHORSE perf HUD, `VIEW`): **2527 × 1293 CSS px @ DPR 1.50** on
  the dev desktop — so `innerHeight ≈ 1293` is the number to tune against. The `@1.50x` is
  `devicePixelRatio`, not zoom; CSS px already fold in DPR, so the shim works in CSS px and
  DPR crispness is Darley's, not the unit's.
- **Form:** `--glass-u ≈ (100 / N)vh`, N = how many glass-units tall the plane reads as.
  It auto-adapts to any height; 1293 is only the sample you pick N against. Exact N left to
  scope work (user deferred unit detail: "sensible + roughly best-practice").
- **Deliberately omits everything Darley owns:** width-derive-from-aspect, `vmin` / `clamp`
  ultrawide + small-screen guards, responsive zoom limits, the camera-meets-display seam.
  The shim "just sort of targets the desktop."
- **Delete-on-Darley.** This is Darley's desk borrowed early; when she lands she replaces
  the `vh` shim with the real fix-height/derive-width mapping. Mark it so it's retired, not
  enshrined.

## Non-goals (the seam to the other sires)

- **Pixels, viewport, "what fits".** The concrete `--glass-u` derivation, clamps,
  responsive zoom limits, and the camera-meets-display mapping are **Darley's**
  ([darley-arabian.md](darley-arabian.md)). Byerley stays unit-relative and pixel-free.
- **Alternate representations.** Phone reflow / stacking, touch ergonomics, ultrawide
  redistribution, alternate widget forms are **Godolphin's** — swapping representation
  when one mapping won't serve. Byerley makes these *tractable*; it does not perform
  them. The current phone-containment stopgap (drawer killed below 620px, bar stacked)
  stays exactly as-is — a holding action — until Godolphin gives the phone a real
  representation.

## Provenance

Graduated from the parked "Floating timeline chrome + mobile" project
([../debut/parked.md](../debut/parked.md)); receipts for the float and the scale-jank
in [../debut/done.md](../debut/done.md).
