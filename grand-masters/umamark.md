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

## Locked kickoff design (2026-06-21)

The proposed deliverables above were confirmed and sharpened in a kickoff with the user.
Recorded here as the build contract.

### Scene — the bake *is* the fixture (no synthetic cards)

The future is **frozen Japanese history** projected onto Global's clock, so the real
timeline is already deterministic by construction. The benchmark scene is therefore the
**real timeline over its full launch → 5th-anniversary extent** (`displayExtent`'s
`[lo, hi]`, which already reaches ~the 5th-anniv horizon — as far as JP's past lets us
project). This dissolves the synthetic-vs-real open call: synthetic was only ever a hedge
against bake-drift, and a frozen bake has none. Bonus: real card geometry + real density
peaks (anniversaries, festival stacks) instead of a made-up worst case.

### Motion — frame-stepped, screen-width-relative

Driven by a **gated benchmark seam on the Timeline** (set `panX`/`z` directly + `applyPan`),
*not* `warpTo` — its glide physics would make the motion non-deterministic. Each animation
frame advances the camera by a fixed fraction of screen-width; the run is a fixed frame
count, so every run renders the **same visual sweep over the same number of frames** — a
fast device just finishes sooner. The score is the per-frame render-cost distribution, not
wall-clock, which is what makes it comparable device-to-device. All passes run at the
**fitted/overview zoom** (`zBaseFitted` — the z the timeline opens at; vertical fit, with
the always-huge horizontal extent giving the sweep its room). No scripted zoom workload —
both tests are pan-based.

### Run structure

1. **Warmup** — one round trip (start→end→start) @ **20% screen-width/frame**. Primes the
   browser's async loads (scenario art, lazy images) so first-touch decode never pollutes
   the score. **Unmeasured** — pure priming.
2. **Test 1 — Fillrate** — **10 round trips @ 50% screen-width/frame**, fitted zoom.
   Guarantees every card paints; big per-frame jumps = max cards crossing the cull boundary
   = peak churn + paint/raster. **Measured** (one capture across all traversals).
3. **Test 2 — Transparency** — a benchmark-owned **screen-fixed centre sampler**, sized to
   the **commit-surface footprint** (indicative). Same motion (**one back-and-forth cycle @
   ~10% screen-width/frame**) run **3× — once per blend mode, captured separately**:
   1. **Opaque** — no alpha; baseline (zero alpha-blend GPU pressure).
   2. **Simple alpha** — ~10% see-through, straight per-pixel blend, no filter.
   3. **Frost** — the real `--glass-blur` backdrop-filter the surfaces use.
   The **delta between the three distributions is the isolated frost cost** — the measured
   answer to the parked blur verdict. (A *moving* backdrop forces frost to re-sample each
   frame = the true worst case.) Key insight: page JS cannot see GPU/compositor/raster time
   directly, so frame-ms inflation across the 3 modes *is* the in-page proxy for blend cost.

### Instrument — self-contained, mobile-safe

UmaMark runs **entirely in-page** (no CDP / external driver) — because the constrained
hardware where the verdict bites (the iPhone-SE) doesn't expose CDP. That forces:
- **`performance.now()` frame-ms = the universal spine.** Score = p50/p95/p99/max ms, mean
  fps, **%-over-budget** vs the instrument's learned `budgetMs`. Works on every device.
- **LoAF + `performance.memory` = progressive enhancement** — Chrome/Android only (iOS
  Safari ships neither), feature-detected, captured where present (slow-frame autopsy +
  heap delta), **silently absent on iOS, never gating the score**.

A run produces the same headline number everywhere; the blur verdict rides on the Test-2
frame-ms delta, which is universal — answerable on the actual constrained device.

### Scene hygiene + widget

- **Hide all real glass surfaces for the run** (menubar, dropdowns, surface layer,
  bookmarks, minimap, MangoHorse) — restore on completion. Keep the world (timeline +
  scenario wallpaper). A clean, uncluttered scene; the sampler is the only overlay.
- A dedicated **mini widget** — live **fps** + **% progress** + current phase. **No data
  capture from the widget** (it's a readout; the score lives in the capture buffer). At the
  end it expands into a compact **results card** (per-test p50/p95/p99/max, fps,
  %-over-budget + the Test-2 frost delta) — on-screen because the phone has no console; on
  desktop also `console.table`'d for copy-paste diffing.

### Invocation — touch-reachable, flagged

F2 is desktop-only, so the real entry is a **button**. UmaMark is the **Beta chamber's**
first real tenant (purpose-built "prove a WIP feature before it graduates"; all plumbing —
`RightSurface "beta"`, `onBeta`, the `renderSurfaces` branch — already exists, just no
menubar entry). The chamber's visibility **is the feature flag**:
- **`?umamark` in the URL** (per-session, **not** persisted) reveals the 🔨 Beta menubar
  icon. Lightest self-contained, mobile-friendly mechanism; none existed before.
- Inside the chamber: a **"Run UmaMark"** button → `presentConfirm` ("Run benchmark? Takes
  over the screen for ~Ns") → on confirm: **reset the camera to the canonical start** (scene
  start = launch edge, fitted zoom — every run begins identically) → hide surfaces → run.
- F2 / MangoHorse untouched.

## Result — the blur verdict, SETTLED (2026-06-21)

Built and run on two devices. **Keep the always-on frost** — its own cost is measured as
negligible everywhere. But the two runs are *not* the same story, and the difference is the
honest finding:

- **Desktop (7900XT, 144Hz):** fully **vsync-bound with headroom** — every percentile pinned
  to ~6.9ms, **0% over budget**, frost↔opaque delta **+0.0ms**. Frost is free; the GPU finishes
  every frame inside the refresh deadline, and page JS can't see sub-frame GPU time, so there's
  nothing to observe because there's nothing to pay.
- **iPhone 14 (60Hz, budget 15.6ms):** frost is **cheap, not literally free**. The three
  transparency modes hold **59fps / 6% over**, p95 24 / 24 / **25**ms — frost↔opaque delta
  **+0.0ms p50, +1.0ms p95**. That ~1ms at p95 is a *real* measured cost (the run wasn't
  vsync-bound, and the card said so), but ~4% of a frame → trivially affordable.

So the **`--glass-blur` blur verdict is resolved: keep always-on frost** (Byerley's parked
state stands) — free on desktop, +1ms p95 on a mid 60Hz phone, no measured reason to drop it.

**Separate, bigger finding (NOT a blur question → Godolphin/Part 3):** the **Fillrate** pass
exposed that the iPhone genuinely struggles with the worst-case fast full-speed pan — **44fps,
40% over budget, p99 49ms, max 105ms** (paint + cull churn at 50%/frame, no sampler involved).
The phone is not headroom-rich; frost was never the bottleneck — fast-pan fill is. A real
mobile-perf datapoint for Godolphin, captured for free as a side effect.

Two instrument bugs the first run exposed and fixed (`ui/perf.ts`): (1) the device budget was
learning the fastest *single* frame and latched a 4.0ms coalesced-frame artifact — now derived
from **peak windowed fps** (vsync-capped, immune to single-frame spikes); (2) per-frame
over-budget counted any frame `> budget` (so vsync jitter read 100% over) — now counts genuine
misses only (`≥ 1.5× refresh`). The results card also interprets a vsync-bound run in words so
`+0.0ms` reads as "free here", not "broken". Open sanity note: the iPhone 14 run reported
~144fps (a 60Hz panel) — verdict holds at any refresh, but the iOS fps integration is worth an
eyeball someday.

**Status: harness kept, path retired.** The `?umamark` URL trigger was removed (`app.ts`
`umamarkEnabled = false`) now the verdict is in, but the whole harness + Beta-chamber launcher
+ `perf.capture()` + the timeline `bench` seam are left **intact and revivable** (flip the one
constant) for the next perf question — mobile regressions, a culling change, a new heavy
surface, zoom cost. It costs nothing to keep.

## Starting point (as-built, on `darley-arabian`)

- `ui/perf.ts` — `perfInstrument({ drainChurn })` → `{ snapshot(), subscribe() }`;
  `PerfSnapshot` already carries `fps / frameMs / fpsSamples / churnP99/P999/Max /
  budgetMs / overBudget`. UmaMark adds `capture()` here.
- `views/perfHud.ts` — dumb consumer (the Afterburner view); reference for how to read the
  instrument and for a results-panel style.
- `app.ts` — `perfInstrument` constructed and wired to the HUD + `tl.drainChurn()`; the
  timeline (`tl`) is the camera UmaMark scripts.
