# Trackblazer Design

Status: **delivered — spatial culling resolved the gate.**

Trackblazer was the renderer-performance redesign for the Horsetrader timeline.
The current app could hit good FPS, but the DOM count was already large and would
only grow with the bake. The design goal was not "make the current DOM faster"; it
was to stop treating DOM as the scene graph.

This document is the design as built: the governing principle, the measurement
that gated scope, the spine that shipped (scene model → cull), and the scaling
future it leaves open. The deeper interventions that were designed but never needed
to be built — pooling, imposters, the detail resolver, warp-transit handling, LOD
— live in [considered.md](considered.md). The outcome is at the end: culling alone
met the budget, and the checkpoint strategy stopped the spine there.

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

The first number to measure was:

> Of the current timeline cards and DOM nodes, how many are offscreen at the
> captured viewport?

That ratio decided the scope. The answer, measured: **94% offscreen at the worst
hand-picked frame** — the live set culling plus a one-viewport overscan must carry
is ~35 cards of 618. That is well inside the 40-60 target, and it meant the first
order-of-magnitude win was available from plain spatial culling without imposters,
bitmap caches, canvas, or WebGL. The full baseline, the churn benchmark, and the
post-cull result are in [appendix.md](appendix.md).

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
- minimap primitives;
- overscan and transition-zone objects.

This is what the browser must style, paint, composite, upload, or draw now. After
culling, it is the viewport slice plus a one-viewport overscan — roughly an order
of magnitude smaller than the known scene.

### Interactive DOM Budget

Focusable, clickable, semantic DOM:

- readable full cards;
- buttons, chips, toggles, and controls;
- labels, tooltips, and accessibility affordances;
- viewport chrome controls.

Interactive DOM should be the smallest budget. It belongs around content the user
can inspect or act on now.

## Core Strategy

Use virtualization as the architecture, with a custom spatial virtualizer.

Existing list/grid virtualizers were useful prior art, but Horsetrader is not a
row list:

- x is a true-to-date world axis;
- below-lane cards are vertically packed;
- above-lane groups are horizontally nudged while stems stay true;
- Home, search, bookmarks, and planner rows use smooth move-to navigation;
- the minimap can seek or potentially warp;
- future zoom changes camera scale, not layout;
- viewport chrome is separate from the timeline world.

The spine that shipped:

1. Build a renderer-facing scene model.
2. Measure card footprints (the existing packer, once, on the commit path).
3. Run packing into world-space bounds.
4. Record each card's world-x bounds.
5. Query viewport plus overscan on the camera path.
6. Mount only that live slice; keep interactive DOM only where the user can read
   or act.

This is **scene model → cull**. The originally-planned follow-ons — shell pooling,
a detail resolver, imposters — were conditional on culling proving insufficient. It
did not, so they were not built; see [considered.md](considered.md).

## Scene Model

The scene model is the known-world layer between selectors and DOM. It holds stable
records:

- `sceneId`;
- semantic source id;
- lane/surface;
- date and world x;
- measured/derived footprint;
- packed world bounds;
- focus/search/bookmark target metadata.

The scene model may be large. That is acceptable. It is data, not mounted DOM. In
the shipped renderer it lives as `scene[]` of `{id, el, left, right}` world bounds
plus `mountedIds`, reconciled on the camera path as pure arithmetic against
precomputed bounds — it reads no geometry, so it forces no reflow.

## Packing

The packer needs sizing information, so Trackblazer cannot ignore offscreen cards
at layout time. Packing operates over known scene footprints and produces
world-space bounds. Every card is built and packed once on the commit path, so the
packer still measures real heights and nudges; culling only governs what stays
*mounted* afterward.

Packed bounds are stable during interaction and within a committed world. Pan,
zoom, warp, and settled-view interaction do not move world bounds; they only move
the camera or change what slice is live.

Packed bounds may change on an explicit commit: stream toggle, domain recompute,
configuration change, or another action that deliberately changes the settled
world. That is allowed to be expensive relative to the continuous path. A discrete
commit can spend real work repacking if the user just asked the app to change the
model.

The commit path is correct-on-reveal. A viewport-anchored surface can own the
user's attention while the timeline repacks behind it. The shield does not need to
hide the world optically; it only needs to own the fovea. Changes outside the locus
of attention can settle without a designed transition.

Important distinction:

- "needed for layout" does not mean "must stay mounted";
- "known to the scene" does not mean "interactive DOM";
- "visible now" is a query over packed bounds.

Watch for a second cliff here: even with the live DOM virtualized, a global
O(all events) pack on every domain recompute may still become expensive. Measure
pack cost separately from render cost. (Not yet a problem at the current bake; the
commit path's initial mount measured ~1,236 nodes in one frame, two orders of
magnitude above camera-path churn — comfortably the expensive budget's home.)

## Culling

Culling was the first real intervention, and it resolved the gate. The shipped form
is **retained-element culling**: every card is built and packed once, the substrate
records each card's world-x bounds, and only the slice inside the viewport plus a
one-viewport overscan stays mounted. Cards leaving the window are detached, not
destroyed, and their element instances are kept — a card re-entering the window
re-attaches its own content.

Given the camera, the camera-path reconcile:

1. Converts viewport to world-space bounds.
2. Adds overscan.
3. Queries the scene bounds (pure arithmetic, no geometry reads).
4. Attaches cards entering the window, detaches cards leaving it.

The active window was measured first, then tuned by feel. Retaining each element
deliberately **defers pooling**: with no shell reuse, the recycler-flash failure
mode cannot occur — a re-entering card paints its own content, never a neighbour's.

## Findability

Findability is solved by semantic app navigation, not native text search.

Unmounting cards means native Ctrl+F cannot search every rendered glyph, but that
is not a meaningful loss for this product. A freeform search that resolves `kita`
into distinct Kitasan Black variants and warps to the selected result is better than
native find. Native find cannot disambiguate card variants, know future
appearances, or understand that a favourite has multiple future returns.

Findability lives in:

- app search is the canonical find mechanism;
- favourites/bookmarks;
- planner rows;
- Home;
- minimap navigation.

These all query the known scene, compute a target date, and move the timeline. With
most of the timeline unmounted at any moment, semantic
search/favourites/planner materialization is not optional — it is how the user
reaches culled content, and it exists from the first virtualized renderer.

Screen-reader support for the timeline is out of scope. The primary content is
irreducibly visual: a spatial field of dated cards, character art, lane position,
density, and motion. There is no useful non-visual equivalent of that scene for
Trackblazer to preserve while virtualizing. The real concern was findability when
content is unmounted, and the semantic navigation stack answers that better than
native rendered-text search would.

Chrome focus hygiene is still worth doing, but it is bounded UI behavior rather than
a timeline-renderer requirement:

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

The end-to-end nav test that mattered: search for an entity whose card is currently
culled, choose a result, warp to it, and land with no blank frame or distracting
pop. Post-cull this works without special transit handling — warp churn is trivial
and retained elements re-attach fast enough that the destination is live on arrival.
The warp-transit detail handling that was designed for a more expensive warp
(don't-promote-the-middle, endpoint materialization) proved unnecessary and is
recorded in [considered.md](considered.md).

Minimap navigation is unsettled:

- current click/drag uses instant `centerOn`;
- click may become intent-based `warpTo`;
- drag may remain direct camera control.

Favourites need an explicit multi-appearance policy. A favourite can have several
future appearances, so tapping the row must choose one:

- nearest;
- next future;
- step-through on repeated activation;
- another policy, if user testing suggests it.

Whatever policy wins, it should be stable and shared by the bookmark list, minimap
pips, and planner-adjacent navigation where applicable.

The minimap marker should stay symbolic. A faithful viewport-over-world marker would
be too narrow to grab, and zoom can make that worse. The drawn handle and the
navigation mapping should be decoupled:

- draw a comfortable oversized marker;
- map click/drag coordinates to the exact world date underneath;
- allow warp-on-click to land true even though the handle is symbolic.

This gives "symbolic marker, exact navigation."

## Zoom (scaling)

Zoom is a camera feature, not a layout feature.

Cards, stems, lanes, and dots keep their world-space relationships. Zoom maps the
world into the viewport through a bounded camera transform. Continuous zoom should
not repack.

Desired behavior:

- pinch-to-zoom on touch;
- Ctrl/Cmd + wheel on the timeline;
- min/max clamp like a 2D game camera;
- zoom anchored under cursor or pinch center;
- minimap and move-to stay coherent with camera scale.

Zoom can become the responsive strategy for the timeline: one world layout, camera
scale instead of many resolution-specific CSS variants. The culling reconcile is
already transform-aware (it ignores `panX`), so it is zoom-safe by construction —
which is what keeps zoom an open scaling lever rather than a re-architecture. The
full scope — optical scale, the `z`-aware conversion spine, the counter-scale for
infinitely-thin struts, and the fit-to-height bounds — is in [zoom.md](zoom.md).

## Compositor Constraint (scaling)

A single clean promoted layer for the whole timeline is not a safe assumption:
browsers and GPUs have texture/layer size ceilings that vary by engine and
hardware.

Virtualization is therefore not only a DOM-count strategy. It also keeps the live
composited surface close to viewport-sized instead of asking the browser to deal
with a huge transformed world — which is what makes the renderer robust as the bake
grows and as zoom stretches the world axis.

## Outcome

The gate is resolved. Culling alone met the budget.

Post-cull baseline (F3, 25 sweeps, 5,892 frames): camera-path churn p99 / max =
16 / 29 nodes/frame, mean ~5; framerate ~144 locked. The pre-cull warp sawtooth
(~79 fps average) is gone — that cost was pure paint/composite of ~618 live cards
transformed at warp speed, and with the live set bounded to the viewport window it
is removed. Full numbers in [appendix.md](appendix.md).

Per the checkpoint strategy, this is the success case where the spine stops early.
The conditional follow-ups do **not** open on this evidence:

- shell **pooling** is not built — retained-element culling holds the framerate
  with trivial churn, and skipping it keeps the recycler-flash failure mode off the
  table entirely;
- **warp endpoint-materialization** is not built — warp transit churn is trivial,
  so there is no fast middle to stop materializing;
- the **detail resolver**, **imposters**, **LOD**, **canvas**, and **WebGL** remain
  closed.

These reopen only if a later trace shows the live window's paint or the cull
turnover regressing past budget — the realistic triggers are **scaling** ones:
zoom stretching the world, a much larger bake, or a slower device. The designs for
those moves are preserved in [considered.md](considered.md), ready but unbuilt.

## Checkpoint Strategy

The intervention list was a sequence of checkpoints, not a fixed build plan. After
each step the loop is:

> improve -> measure -> decide.

Re-run the harness after each intervention and ask whether the numbers already clear
the goal. It is a likely and acceptable outcome that culling alone meets the budget
and the remaining steps are never built. Stopping early is success, not an abandoned
plan — and that is exactly what happened here. The conditional follow-ups only open
if a trace at a checkpoint proves the spine so far cannot carry the load.

This is also why the expensive commit/repack path needs no special new contract:
repacking already happens behind an attention-owning surface on a discrete commit
(correct-on-reveal). The cost lands on the existing expensive path, so the
checkpoint loop only has to defend the continuous camera path — which culling did.
