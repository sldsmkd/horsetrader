# Grand Masters

> Building the **Mega Dream Supporter**.

## The fiction (and the licence it gives us)

In the Grand Masters scenario, the Satono Group develops a VR device — the *Mega
Dream Supporter* — to prepare trainer and horsegirls for the Twinkle Series. Inside
the virtual world you train and race, assisted by three support AIs, each named for
one of the three legendary founding studs of the modern thoroughbred line.

The VR hook is the point. It hands us aesthetic licence for something we were
already reaching for: a Minority-Report-style holographic glass HUD — UI projected
onto fixed transparent panes, the world running underneath. That is exactly the
thread the glass-table chrome and the zoom-scaling camera were already pulling on.
Grand Masters is where we build it properly.

## Provenance

This is the post-launch graduation of the parked project **"Floating timeline chrome
+ mobile (project in its own right)"** ([../debut/parked.md](../debut/parked.md)).
Make Debut floated the chrome and contained the phone layout as a holding action;
it explicitly deferred picking it up properly. Grand Masters picks it up, split into
phases named for the three sires.

## The three AIs (the phases)

Every modern racehorse traces to one of three foundation sires, so the AIs *are* the
founding studs — fitting for the substrate of a phased build.

- **Byerley Turk** — *order and discipline*. **Part 1.** The disciplined glass
  substrate, **unit-relative and pixel-free**: one coherent orthographic glass system,
  declared planes (membership + depth), honest geometry, a single dimensional unit as
  an abstraction. The spine the other two build on. See [byerley-turk.md](byerley-turk.md).
- **Darley Arabian** — *bravery*. **Part 2.** Grounds the abstraction in **real
  hardware**: owns pixels, scale, the viewport, what can be displayed, and where the
  view is defined and mapped. Resolves `--glass-u` to px, derives responsive zoom
  limits, governs the camera-meets-display seam — still one representation.
  See [darley-arabian.md](darley-arabian.md).
- **Godolphin Barb** — *affection and love*. **Part 3.** Meets each device on its own
  terms: **device-specific representations** — the real phone layout, touch ergonomics,
  alternate surface forms — i.e. a *different* representation when one mapping won't
  serve. See [godolphin-barb.md](godolphin-barb.md). In-game uses "Barb", the
  historical alternate naming, not "Arabian".

The cut between phases, restated as a chain of altitude:

- **Byerley** draws the one coherent representation in the abstract — correct
  *relative to* the unit, never touching a pixel.
- **Darley** grounds that single representation on any real display — px, viewport,
  what fits, responsive limits.
- **Godolphin** decides to show a *different* representation when a display is too far
  out for Darley's single mapping to serve.

Each sire makes the next one's job tractable; none reaches down into the previous
one's desk.

## The grounding (shared substrate for all three AIs)

The rig is two planes, distinguished by projection — and by which projection idiom
each is licensed to use.

### The glass plane — orthographic / parallel projection

A single fixed, camera-independent coordinate system holding every surface, window,
dropdown, drawer, shield, and the wallpaper. No foreshortening, no eye point:
screen-size = object-size × a uniform factor, position-independent. This *is* CSS's
default 2D model — we're not building the orthographic container, we're naming the
substrate we already stand in.

Three orthogonal axes:

- **Membership** — is an element *glass* (fixed coords, shares the glass scale unit)
  or *world* (inside the timeline's `content`, camera-transformed)? Today implicit in
  sibling-vs-child of `content`.
- **Depth** — a declared back→front ladder, *not* the same axis as membership:
  `wallpaper · world · surfaces`. One honest glass-surface band, stacked by spawn
  order. A glass element can project anywhere in the stack. The **scenario wallpaper
  proves this**: it is fully on the glass (fixed coords, no camera) yet rendered
  *behind* the world. Membership ≠ stacking position. (Earlier drafts listed `shields`
  and `lifted-chrome` as depth bands — they aren't; see Modality.)
- **Modality** — when a surface demands exclusivity, a **lock** travels up its spawn
  lineage to the menubar (the spawn-tree root) and fans back down the subtree, turning
  the whole surface plane inert while it stays *visible* (visibility ≠ interactivity).
  Navigation is a *sibling* of the menubar, not a descendant, so the lock never reaches
  it. This is what was miscalled "shields" + "lifted-chrome": **there is no shield
  type** — only one surface type, with *modal demand* and *placement* as orthogonal
  traits. Modality is a lock, not a stacking position. (Byerley formalises this — see
  [byerley-turk.md](byerley-turk.md).)

### The world plane — perspective-emulating camera over a flat surface

The timeline (`content`) is a flat plane navigated like a top-down RTS camera: pan +
zoom. We frame it as a perspective / pinhole camera, but it **never gains depth or
tilt** — no 3D, ever. Because the plane is flat and head-on, perspective-with-
altitude and orthographic-with-zoom are observationally identical, so a single
uniform `transform: scale(z)` *exactly* emulates the camera. Perspective is the
framing; uniform scale is the honest implementation of it.

### The discipline that falls out

`transform: scale` is **the camera's privilege**. On the world plane it is
legitimate — it *is* the projection, so decoupling render-size from layout box is the
camera doing its job. On the glass plane it is a **projection violation**: in a
parallel projection, size *is* dimension, so a glass surface that scales is lying
about its own size. Glass resizes dimensionally (a real unit), never via `scale`.

This is why the existing `--chrome-dropdown-scale: 0.8` jank isn't merely cosmetic —
it imported the camera's idiom into the orthographic frame. Fixing it is Byerley's
work, not a coin-flip "trim vs scale" decision.

## Reference

- Timeline camera / conversion spine:
  [../horsetrader.site/js/src/ui/views/timeline.ts](../horsetrader.site/js/src/ui/views/timeline.ts)
- Z-band mount order (the current implicit depth ladder):
  [../horsetrader.site/js/src/ui/app.ts](../horsetrader.site/js/src/ui/app.ts) (`root.replaceChildren(...)`)
- Scenario wallpaper (fixed-coords glass, sent behind the world):
  [../horsetrader.site/js/src/ui/views/scenarioArt.ts](../horsetrader.site/js/src/ui/views/scenarioArt.ts)
- Float + scale-jank receipts: [../debut/done.md](../debut/done.md)
