# Trackblazer

Status: scoping / R&D.

Trackblazer is the renderer-performance project for the Horsetrader site. The
timeline is already interactive and smooth in the obvious FPS sense, but the DOM
count is large and will grow as the bake grows. The project exists to make the
timeline scale without turning it into a static picture or compromising the
planner's core interaction model.

## Problem Statement

The current timeline treats the browser DOM too much like the scene graph. That
works while the dataset is small enough, but it creates three linked risks:

- live DOM grows with the whole timeline rather than the visible scene;
- continuous camera movement can force too much renderer work;
- node churn, layout, paint, compositing, allocation, and GC can become hidden
  bottlenecks even when FPS looks fine.

The goal is to stop measuring success by headline frame rate alone and start
measuring the renderer as a system.

## Design Goal

Make the timeline renderer scale as a high-density interactive scene.

Trackblazer should:

- keep pan, zoom, and `warpTo` navigation smooth;
- keep the timeline live and interactive while viewport chrome floats above it;
- separate the full known scene from the live renderer and interactive DOM;
- bound live work to the visible/near-visible slice where possible;
- preserve semantic navigation through search, favourites, planner rows, Home,
  and minimap interactions;
- make performance work empirical through repeatable measurements.

## Governing Principle

Trackblazer is governed by a perceptual budget: the renderer owes fidelity and
continuity where the user can actually check it. Elsewhere, it can spend cheaper
representations, delayed realization, or rebuilds.

That gives three paths:

- load path: correct on arrival;
- discrete commit path: correct on reveal;
- camera path: frame-by-frame continuity.

Renderer cleverness should concentrate on the continuous camera path: pan, zoom,
and `warpTo`.

## Intended Shape

The likely architectural spine is:

1. measurement harness;
2. renderer-facing scene model;
3. packed world-space bounds;
4. spatial culling;
5. shell pooling;
6. camera/detail resolver.

LOD, imposters, canvas, WebGL, and bitmap tricks are conditional follow-ups, not
the initial plan.

## Documents

- [design.md](design.md) — current design direction and architecture.
- [appendix.md](appendix.md) — captured measurements, tables, and raw findings.
