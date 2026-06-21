# UmaMark — the deterministic benchmark (Darley's perf, part 2 of 2)

> The 3DMark to MangoHorse's Afterburner. A separate session, broken out of Darley
> ([darley-arabian.md](darley-arabian.md)) once the perf **instrument** landed.

Project frame: [grand-masters.md](grand-masters.md). Builds directly on the perf
instrument shipped in Darley (`horsetrader.site/js/src/ui/perf.ts`).

## Where this came from

Darley's deliverable #5 was always two separable things:

1. **The instrumentation / ownership** — Darley "faces real hardware", so she owns the
   *measurement*. **DONE** (committed on `darley-arabian`): `ui/perf.ts` is the
   instrument (frame loop, fps/frame-ms, churn ring + percentiles, device-refresh budget
   learned from the fastest frames, `overBudget` adherence verdict). MangoHorse
   (`views/perfHud.ts`) was demoted to a **dumb surface** that subscribes to snapshots and
   renders — measurement lifted out, presentation left behind.
2. **The blur verdict** — "drop the frost below what capability?" — **PARKED** (taste
   pass + profiling). It is now *answerable* because `perf.snapshot()` exposes adherence,
   but the answer needs UmaMark to be repeatable rather than eyeballed.

The analogy that settled the shape:

- **MangoHorse = MSI Afterburner / RTSS** — a *passive* overlay over Darley's live
  telemetry. Observes the uncontrolled real session.
- **UmaMark = 3DMark** — an *active*, deterministic stress run. Drives a known workload and
  produces a comparable **score**, not a stream.

## Thesis

A benchmark is only useful if it's **deterministic** — same scene + same motion every run,
so a result is comparable across a code change or across devices. That's the whole
difference from the overlay: Afterburner measures whatever's happening; 3DMark measures a
*fixed* thing. So UmaMark must not ride the user's real plan — it supplies its own
controlled load and drives the camera itself.

## Ownership

Darley's, both halves — because both are the display path. The instrument is the sensor;
UmaMark is the harness that drives the camera through a scripted workload and reads the
sensor. The world/app supplies the *scene*; Darley stresses it and scores it.

## Deliverables (proposed — confirm at kickoff)

1. **Capture session on the instrument.** `ui/perf.ts` today emits *rolling* stats (right
   for the live overlay). A run wants *per-run aggregation*: a small `capture()` lifecycle
   — start → buffer every frame's timing → stop → return the aggregate. Measurement stays
   in the instrument; orchestration is the harness. Keep the rolling snapshot untouched.

2. **A deterministic benchmark scene.** The canned worst case — the ~35-live-card gating
   load (Trackblazer's gating measurement; see darley/trackblazer docs). **Open design
   call (needs your input):** synthetic fixed-N cards (perfectly reproducible, device- and
   data-independent) vs. driving the *real* timeline over its densest region (realistic,
   but varies with the bake). Likely synthetic for comparability, with the real-region run
   as a secondary mode.

3. **A scripted-pan (and zoom) workload + run lifecycle.** A defined camera path — fixed
   velocity, fixed duration, frame-stepped, **not** user input — so the motion is identical
   every run. Invoke → set up scene → drive workload while `capture()` runs → tear down.
   Invocation: a dev keybind / URL param (sibling to F2 for the HUD).

4. **A result / score.** Aggregate the captured frames into a verdict: p50 / p95 / p99 /
   max frame-ms, mean fps, **% of frames over budget** (against the device budget the
   instrument already owns) → pass/fail or a score. Comparable across runs/devices. Render
   it (a results panel, or extend MangoHorse) and/or log it.

## What this unblocks

The parked **blur verdict**: run UmaMark with frost on vs. off on the worst-case scene on
constrained hardware → the threshold ("drop blur below what capability / while moving?")
becomes a measured call, not a guess. Also any future perf question — mobile, a culling
regression, a new heavy surface, zoom cost — gets a repeatable score instead of eyeballing.

## Starting point (as-built, on `darley-arabian`)

- `ui/perf.ts` — `perfInstrument({ drainChurn })` → `{ snapshot(), subscribe() }`;
  `PerfSnapshot` already carries `fps / frameMs / fpsSamples / churnP99/P999/Max /
  budgetMs / overBudget`. UmaMark adds `capture()` here.
- `views/perfHud.ts` — dumb consumer (the Afterburner view); reference for how to read the
  instrument and for a results-panel style.
- `app.ts` — `perfInstrument` constructed and wired to the HUD + `tl.drainChurn()`; the
  timeline (`tl`) is the camera UmaMark scripts.
