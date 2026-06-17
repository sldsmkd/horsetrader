# Trackblazer Design

Status: design draft.

Trackblazer is the renderer-performance redesign for the Horsetrader timeline.
The current app can hit good FPS, but the DOM count is already large and will
only grow with the bake. The design goal is not "make the current DOM faster";
it is to stop treating DOM as the scene graph.

## Governing Principle

Trackblazer is governed by a perceptual budget.

The renderer only owes fidelity and continuity where the user can actually check
it. Everywhere else is slack the renderer can spend.

This is not a license to lie about the model. It is a rendering rule:

- Load must be correct on arrival.
- Discrete commits must be correct on reveal.
- Camera movement must be continuous where the user is watching.
- Offscreen, peripheral, fast-moving, occluded, or unattended regions can use
  cheaper representations or rebuilds.

Two existing ideas are instances of this principle:

- fast motion exploits the readability ceiling: at high px/frame, users read
  motion, density, shape, and colour, not text;
- viewport-anchored surfaces exploit the attention ceiling: while a surface owns
  the fovea, the timeline can settle behind it without the user inspecting every
  intermediate frame.

The channels fall out of that:

- load path: correct-on-arrival;
- discrete commit path: correct-on-reveal;
- camera path: frame-by-frame continuity.

## The Gating Measurement

The first number to measure is:

> Of the current timeline cards and DOM nodes, how many are offscreen at the
> captured viewport?

That ratio decides the scope.

If most cards are offscreen, the first win is probably plain spatial
virtualization plus pooling. If viewport culling can cut live card DOM from the
whole timeline to the visible slice plus overscan, the renderer may get the first
order-of-magnitude win without needing imposters, bitmap caches, canvas, or
WebGL.

The rough capture estimate and current numeric findings live in
[appendix.md](appendix.md).

So the first audit must report:

- total timeline cards/renderables;
- visible cards/renderables;
- near-visible cards/renderables;
- offscreen cards/renderables;
- DOM nodes by surface and component family;
- nodes per card family;
- live renderer churn during pan and `warpTo`.

## Budget Model

Trackblazer has three budgets. Keep them separate.

### Known Scene Budget

Everything the renderer can reason about as data:

- scene ids;
- world-space positions;
- measured or derived footprints;
- packed bounds;
- tile/chunk membership;
- search/bookmark/navigation targets;
- cache metadata.

Known scene objects may exist without being mounted.

### Live Renderer Budget

Objects actively realized by the renderer:

- mounted full cards;
- pooled shells assigned to visible objects;
- flat imposters, if needed;
- minimap primitives;
- overscan and transition-zone objects.

This is what the browser must style, paint, composite, upload, or draw now.

### Interactive DOM Budget

Focusable, clickable, semantic DOM:

- readable full cards;
- buttons, chips, toggles, and controls;
- labels, tooltips, and accessibility affordances;
- viewport chrome controls.

Interactive DOM should be the smallest budget. It belongs around content the user
can inspect or act on now.

## Core Strategy

Use virtualization as the architecture, but roll a custom spatial virtualizer.

Existing list/grid virtualizers are useful prior art, but Horsetrader is not a
row list:

- x is a true-to-date world axis;
- below-lane cards are vertically packed;
- above-lane groups are horizontally nudged while stems stay true;
- Home, search, bookmarks, and planner rows use smooth move-to navigation;
- the minimap can seek or potentially warp;
- future zoom changes camera scale, not layout;
- viewport chrome is separate from the timeline world.

The spine is:

1. Build a renderer-facing scene model.
2. Measure or derive card footprints.
3. Run packing into world-space bounds.
4. Store bounds in spatial tiles/chunks.
5. Query viewport plus overscan.
6. Reconcile that live set through pools.
7. Keep interactive DOM only where the user can read or act.

This is scene model -> cull -> pool. Everything else is conditional.

Initial R&D ordering:

1. Measurement harness.
2. Scene model and packed bounds.
3. Spatial culling.
4. Shell pooling and reconciliation.
5. Layout/packing pipeline instrumentation.
6. Camera resolver for pan, warp, minimap, and zoom.

LOD and imposters are parked until traces show culling + pooling cannot handle
warp-transit load. Bitmap imposters are deleted from initial scope.

## Scene Model

The scene model is the known-world layer between selectors and DOM. It should
contain stable records like:

- `sceneId`;
- semantic source id;
- lane/surface;
- date and world x;
- measured/derived footprint;
- packed world bounds;
- tile/chunk membership;
- current detail eligibility;
- focus/search/bookmark target metadata.

The scene model may be large. That is acceptable. It is data, not mounted DOM.

## Packing

The existing packer needs sizing information, so Trackblazer cannot simply ignore
offscreen cards. Packing should operate over known scene footprints and produce
world-space bounds.

Packed bounds are stable during interaction and within a committed world. Pan,
zoom, warp, and settled-view interaction do not move world bounds; they only move
the camera or change what slice is live.

Packed bounds may change on an explicit commit: stream toggle, domain recompute,
configuration change, or another action that deliberately changes the settled
world. That is allowed to be expensive relative to the continuous path. A
discrete commit can spend real work repacking if the user just asked the app to
change the model.

The commit path is correct-on-reveal. A viewport-anchored surface can own the
user's attention while the timeline repacks behind it. The shield does not need
to hide the world optically; it only needs to own the fovea. Changes outside the
locus of attention can settle without a designed transition.

Important distinction:

- "needed for layout" does not mean "must stay mounted";
- "known to the scene" does not mean "interactive DOM";
- "visible now" is a query over packed bounds.

Watch for a second cliff here: even if live DOM is virtualized, a global O(all
events) pack on every domain recompute may still become expensive. Measure pack
cost separately from render cost.

After a repack, the renderer receives new bounds and rebuilds or reconciles the
revealed live set from those bounds. It does not need to preserve every
intermediate placement. If the commit happened behind an attention-owning
surface, rebuilding the visible/near-visible live set from scratch is fine.
Pooling and incremental reconciliation are frame-critical on the continuous
camera path, not on an occluded/peripheral commit reveal.

## Culling

Culling is the first real intervention to validate.

Given the camera:

1. Convert viewport to world-space bounds.
2. Add overscan.
3. Query spatial tiles/chunks.
4. Keep full DOM for readable/interactable objects.
5. Keep simpler live renderer objects only if needed.
6. Keep everything else in the known scene only.

The active window should be measured scientifically first, then tuned by feel.

## Pooling

Virtualization without pooling can become churn.

The renderer should reuse compatible shells:

- above-lane banner group shells;
- below-lane card shells;
- compact/mission card shells;
- flat low-detail shells, if introduced;
- repeated substructures only if profiling shows they dominate churn.

Metrics must include:

- nodes created;
- nodes destroyed;
- nodes reused;
- pool hits/misses;
- promotion/demotion counts;
- allocation and GC pressure.

The goal is not only fewer live nodes. It is fewer short-lived objects and fewer
GC spikes.

## Findability

Findability is solved by semantic app navigation, not native text search.

Unmounting cards means native Ctrl+F cannot search every rendered glyph, but that
is not a meaningful loss for this product. A freeform search that resolves
`kita` into distinct Kitasan Black variants and warps to the selected result is
better than native find. Native find cannot disambiguate card variants, know
future appearances, or understand that a favourite has multiple future returns.

Findability lives in:

- app search is the canonical find mechanism;
- favourites/bookmarks;
- planner rows;
- Home;
- minimap navigation.

These all query the known scene, compute a target date, and move the timeline.

If the offscreen estimate holds, this is the default state: most of the timeline
would be unmounted at any moment. Semantic search/favourites/planner
materialization must exist from the first virtualized renderer.

Screen-reader support for the timeline is out of scope. The primary content is
irreducibly visual: a spatial field of dated cards, character art, lane position,
density, and motion. There is no useful non-visual equivalent of that scene for
Trackblazer to preserve while virtualizing. The real concern was findability when
content is unmounted, and the semantic navigation stack answers that better than
native rendered-text search would.

Chrome focus hygiene is still worth doing, but it is bounded UI behavior rather
than a timeline-renderer requirement:

- Escape closes drawers and overlays where appropriate;
- modal surfaces trap focus and return it on close;
- search, favourites, planner rows, and menus have sane tab order;
- keyboard activation triggers the same `warpTo` paths as pointer activation.

That work lives in the always-mounted chrome and does not require keeping culled
timeline cards in DOM.

## Move-To Navigation

`warpTo` is core behavior, not animation polish.

Home, search, bookmarks, and planner rows already use `warpTo`. Potential future
minimap click behavior may join the same path. They are one navigation problem:

```text
trigger -> compute target date -> call warpTo
```

The triggers differ; the renderer contract is the same. Existing search and
bookmark navigation are not speculative; they are already live `warpTo` users.

Long warps can move too fast for card text to matter. Do not promote every
in-transit card to full DOM during a long warp. Render the start and destination
neighborhoods for real. The middle can be low-detail or not materialized,
depending on the measured feel. See [appendix.md](appendix.md) for current warp
speed findings.

Minimap navigation is unsettled:

- current click/drag uses instant `centerOn`;
- click may become intent-based `warpTo`;
- drag may remain direct camera control.

The measurement suite should cover both instant seek and smooth warp.

The most important end-to-end nav test is a real user flow: search for an entity
whose card is currently culled, choose a result, warp to it, materialize the
destination slice before arrival, and land with no blank frame or distracting
pop.

Favourites need an explicit multi-appearance policy. A favourite can have several
future appearances, so tapping the row must choose one:

- nearest;
- next future;
- step-through on repeated activation;
- another policy, if user testing suggests it.

Whatever policy wins, it should be stable and shared by the bookmark list,
minimap pips, and planner-adjacent navigation where applicable.

The minimap marker should stay symbolic. A faithful viewport-over-world marker
would be too narrow to grab, and zoom can make that worse. The drawn handle and
the navigation mapping should be decoupled:

- draw a comfortable oversized marker;
- map click/drag coordinates to the exact world date underneath;
- allow warp-on-click to land true even though the handle is symbolic.

This gives "symbolic marker, exact navigation."

## Zoom

Zoom is a camera feature, not a layout feature.

Cards, stems, lanes, and dots keep their world-space relationships. Zoom maps the
world into the viewport through a bounded camera transform. Continuous zoom
should not repack.

Desired behavior:

- pinch-to-zoom on touch;
- Ctrl/Cmd + wheel on the timeline;
- min/max clamp like a 2D game camera;
- zoom anchored under cursor or pinch center;
- minimap and move-to stay coherent with camera scale.

Zoom can become the responsive strategy for the timeline: one world layout,
camera scale instead of many resolution-specific CSS variants.

## Detail Resolver

Zoom, pan speed, and warp speed should feed the same detail resolver:

```text
camera state + object bounds + focus state -> detail band + live representation
```

Detail bands might be:

- full interactive card;
- full visual card but not focusable;
- flat pooled shell;
- no live object.

Start with the simplest resolver: viewport/overscan culling and pooled full
cards. Add lower detail bands only if measurement shows culling + pooling is not
enough.

The resolver reads committed bounds. It does not repack during pan, zoom, or
warp. Repacking belongs to explicit commits and domain recompute, then the
resolver reconciles the new visible slice.

The resolver is the perceptual budget in code: given camera state, attention
state, and object bounds, decide what fidelity the renderer owes now.

## Imposters

Imposters are conditional, not the spine.

The likely cheap version is a flat pooled DOM shell by card type, stretched to
the measured bounds. It should preserve only what matters at speed:

- shape;
- lane;
- rough size;
- family/banner colour;
- important favourite/commitment/value cues if needed.

It should drop:

- glows;
- filters;
- shadows;
- text;
- reward strips;
- buttons;
- chip detail.

Bitmap/raster imposters are out of initial scope. They risk GPU raster cost,
texture upload, VRAM pressure, compositing pressure, CORS/canvas tainting, and
cache memory. Bring them back only if measurement proves flat pooled shells are
not enough.

Current stance: do not build bitmap imposters. Delete that branch from initial
scope unless a trace later proves the simpler spine cannot handle the load.

## Compositor Constraint

A single clean promoted layer for the whole timeline is not a safe assumption:
browsers and GPUs have texture/layer size ceilings that vary by engine and
hardware.

Virtualization is therefore not only a DOM-count strategy. It also keeps the live
composited surface close to viewport-sized instead of asking the browser to deal
with a huge transformed world.

## First Milestone

Build the measurement harness and answer the gating question.

Required output:

- offscreen ratio at the captured viewport size;
- known scene budget;
- live renderer budget;
- interactive DOM budget;
- DOM nodes by surface and card family;
- visible/near-visible/offscreen card counts;
- pack cost;
- initial render cost;
- pan cost;
- short and long `warpTo` cost;
- minimap seek cost;
- node churn and GC/allocation pressure.

Only after that choose the first intervention.

Expected first intervention if the offscreen ratio is high:

1. scene model;
2. packed bounds;
3. spatial culling;
4. shell pooling.

LOD, imposters, canvas, and bitmap caching remain conditional follow-ups.
