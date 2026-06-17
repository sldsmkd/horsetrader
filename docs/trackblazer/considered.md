# Trackblazer — Considered, Not Built

Status: preserved thinking.

Spatial culling resolved the gate on its own (see [design.md](design.md) Outcome
and [appendix.md](appendix.md) Culling Checkpoint). Per the checkpoint strategy,
the spine stopped there: retained-element culling holds a 144 fps lock through
full-extent warp with trivial churn, so none of the interventions below needed to
be built.

This document keeps them anyway. They were designed before the measurement came
in, and the reasoning is worth retaining — both as a record of what was weighed,
and as the ready-made next moves if a later trace (zoom, a much larger bake, a
slower device) reopens the question. Nothing here is a TODO. It is the road not
taken, written down.

## Pooling

The plan if culling alone churned too hard. Retained-element culling keeps each
card's element instance and re-attaches it on re-entry, so there is no shell reuse
and no churn beyond attach/detach. Pooling would have replaced that with a finite
set of reusable shells assigned to whichever objects are live — necessary only if
retaining every element's instance had proven too memory-heavy or if attach/detach
itself dominated.

The renderer would reuse compatible shells:

- above-lane banner group shells;
- below-lane card shells;
- compact/mission card shells;
- flat low-detail shells, if introduced;
- repeated substructures only if profiling showed they dominate churn.

**Keyed reconciliation.** A shell binds to a `sceneId`, and the live set is diffed
by key against the previous frame's set, not rebuilt positionally. Without keys a
pan that shifts every card by one slot reassigns every shell.

**Recycler flash** is the failure this section exists to prevent — the classic
pooling bug. When a shell is reassigned to new content, the new content can paint a
frame late, so the user briefly sees the *previous* card's text at the new
position. It feels janky even when every metric is green. The reuse path must make
"old content never shows at the new position" an explicit rule:

- clear-then-fill (blank the shell before it moves/repaints);
- hide-during-reassign (visibility off until the new content is committed);
- double-buffer (build the new content, then swap).

Retained-element culling sidesteps this entirely — a card re-attaches *its own*
content, so there is no foreign content to flash. That is a real reason the simpler
path is also the safer one, and a reason not to reach for pooling without a trace
that demands it.

Metrics a pooled build would need: nodes created / destroyed / reused, pool
hits/misses, promotion/demotion counts, allocation and GC pressure.

**Measurement caveat (still true):** allocation/GC pressure is *not cleanly
observable from JS* — no GC hooks, and `performance.memory` is coarse and
Chrome-only. Any pooling work would read GC from manual DevTools allocation
profiling, not the automated harness.

## Warp-Transit Detail Handling

Designed for a warp that turned out cheap. The worry was that a full-extent warp at
up to ~1,400 px/frame would either paint too many full cards or churn the live
window too hard. Post-cull both were trivial (p99 16 nodes/frame, 144 fps held), so
none of this was built.

**Overscan is a pan concept, not a warp one.** A fixed buffer around the viewport
serves bounded pan velocity. It cannot serve warp — no sane margin reaches
1,400 px/frame. So pan and warp would have been two materialization strategies, not
one tunable knob: pan = a buffer around the viewport; warp = endpoint
materialization. The trap avoided was collapsing them into a single absurd overscan
number.

**Materialize the destination at warp start, not on approach.** `warpTo` computes
the target pan immediately at t=0, so the destination tiles could be queried and
the destination live set built offscreen *while the camera is still travelling* —
the clean guarantee that the slice is mounted before arrival. Building on approach
would reintroduce the blank-frame risk exactly under load. With trivial warp churn
this was unnecessary: the retained elements re-attach fast enough that the
destination is simply live by the time the camera arrives.

**Don't-promote-the-middle.** Long warps move too fast for card text to matter
during transit ([appendix.md](appendix.md) Warp Speed), so a detail-aware renderer
would render the start and destination neighborhoods for real and leave the swept
middle low-detail or unmaterialized. Moot once the live set is viewport-bounded:
there is no expensive middle to thin.

## Detail Resolver

The generalization of culling into graded fidelity. Zoom, pan speed, and warp speed
would feed one resolver:

```text
camera state + object bounds + focus state -> detail band + live representation
```

Detail bands: full interactive card / full visual card but not focusable / flat
pooled shell / no live object. The resolver reads committed bounds and never
repacks during pan, zoom, or warp; repacking belongs to explicit commits, then the
resolver reconciles the new visible slice.

It is "the perceptual budget in code": given camera state, attention state, and
object bounds, decide what fidelity the renderer owes now. Culling is the resolver
collapsed to two bands (full card / nothing). The full resolver only earns its
complexity if intermediate bands are ever needed — which, on current evidence, they
are not.

## Imposters

Conditional from the start, never the spine. The cheap version is a flat pooled DOM
shell by card type, stretched to the measured bounds, preserving only what reads at
speed — shape, lane, rough size, family/banner colour, important
favourite/commitment/value cues — and dropping glows, filters, shadows, text,
reward strips, buttons, and chip detail.

This is fundamentally a **human-acuity** question, not a throughput one: imposters
trade fidelity for cost on content the eye is moving across too fast to read. They
only earn their place if cull+pool leaves a *visible* deficit at speed. The
post-cull warp is clean at full fidelity, so there is no deficit to paper over.

**Bitmap/raster imposters** were cut from initial scope and stay cut. They risk GPU
raster cost, texture upload, VRAM pressure, compositing pressure, CORS/canvas
tainting, and cache memory. They return only if a trace proves flat pooled shells
are not enough — a condition two steps removed from anything measured so far.

## LOD, Canvas, WebGL

The far branches. A level-of-detail system, a canvas-drawn timeline, or a WebGL
scene were always parked behind "culling + pooling demonstrably cannot carry the
load." Culling alone carried it, so these never came into scope. They are recorded
here only to mark that they were consciously weighed and consciously not needed.
