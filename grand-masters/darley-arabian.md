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
into the wild range of actual screens and makes the single representation hold on all
of them.

Still **one representation.** Darley maps Byerley's single coherent glass onto any
display honestly; she does not swap in a *different* representation when a display is
too far out — that is Godolphin.

## Deliverables (firm)

1. **Define the view / viewport.** The authoritative description of the display
   surface and how much of the glass it shows — the single source of truth the rest of
   the system reads "what can be displayed" from.

2. **Resolve `--glass-u` to pixels.** Take Byerley's naive placeholder and make it
   real: fix the authoritative axis (**height** — the timeline well is height-bounded;
   width is "however much time fits"), derive the other from the live aspect ratio (the
   orthographic-camera / Unity CanvasScaler "match height" idiom), with `vmin` /
   `clamp()` guards for ultrawide and small screens. *(Units: sensible + roughly best-
   practice; user deferred the detail.)*

3. **Responsive limits — what fits, how far it scales.** Derive the camera's zoom
   bounds from the viewport rather than hard constants: the un-derived `Z_MIN`/`Z_MAX`
   and fit-to-height, plus sane behaviour on sub-1440p / narrow viewports. This is the
   orphan "responsive zoom limits" concern from the original parked split — it lives
   here because it *is* "what can be displayed" + "where the view is defined and mapped".

4. **The camera-meets-display seam.** Govern where the world-plane camera (the
   timeline's `z` / `panBounds` / `screenToContentX` conversion spine, which trades in
   px and scale) is constrained by the view definition — so the camera's reach and the
   glass's fit agree on one description of the display.

## Non-goals (the seam to the other sires)

- **The abstract structure.** The glass plane, membership, depth ladder, and the
  dimensional discipline are **Byerley's**. Darley grounds them in px; she does not
  redefine them.
- **Alternate representations.** Phone reflow / touch / widget reshaping — showing a
  *different* representation when one mapping won't serve — is **Godolphin's**. Darley's
  job ends at mapping the *single* representation onto whatever display it's given.

## Provenance

Absorbs the "responsive zoom limits on sub-1440p / narrow viewports" strand of the
parked "Floating timeline chrome + mobile" project
([../debut/parked.md](../debut/parked.md)), plus the px-derivation handed forward from
Byerley's glass unit.
