# Trackblazer Appendix

Status: supporting notes.

This appendix holds captured measurements, rough estimates, and other findings
that inform [design.md](design.md) without making the design document expensive
to parse.

## MANGOHORSE Capture

From the HUD capture that motivated Trackblazer:

- FPS: 144
- Frame: 6.9ms
- Cards: 618
- Lanes: 185 / 433
- DOM: 17,851
- View: 2527x1293 @ 1.50x
- Sources: 4,882
- Events: 826
- Predicted: 76%
- Entities: 1,405
- Untranslated: 40
- Bake: 2026-06-16 19:58 UTC

## Timeline Extent

From the current static bake and `timeline.ts` constants:

- Visible events used for display extent: 803 / 826.
- Display extent: 2025-06-26 to 2029-03-31.
- Timeline span: 1,374 days.
- Scale: 120px/day.
- Pad: 3 days on each side.
- Content width: 165,600px.
- At the captured 2,527px viewport, max wall-to-wall pan travel is about
  163,073px.

Rough visual estimate from the screenshot:

- visible cards in frame: about 17;
- total cards: 618;
- visible share: about 3%;
- offscreen share: about 97%.

### Measured Baseline

The HUD now instruments the gating ratio directly (`timeline.visibility()` →
MANGOHORSE `ONSCREEN` / `OFFSCREEN` rows: visible / near-band / offscreen, near
band = one viewport width each side). The estimate is now a measured baseline.

Deliberate **worst case** — the frame hand-picked for the most cards on screen,
at the captured 2,527×1,293 @1.50x viewport:

- total cards: 618;
- visible: 13;
- near-band: 22;
- offscreen: 583;
- offscreen share: 94%.

So even at the busiest frame, the live set culling + a one-viewport overscan must
carry is ~35 cards (visible + near), inside the 40-60 target below. The rough 97%
estimate held — if anything it understated the slack. This validates spatial
culling as the first intervention; no LOD/imposter branch needs to open on this
evidence.

### Churn Benchmark (F3)

Node churn is instrumented as the count of DOM nodes added/removed under the card
host per frame (`MutationObserver`, drained once per frame by the HUD into a ring
for a live p99 / p99.9 / high-watermark readout). Pre-culling this reads ~0 on the
camera path — pan and warp are pure transforms, they don't touch `childList` — so
it establishes the "no churn while moving" floor the cull/pool work must not
regress.

**F3** runs an automated pass: 2 warmup sweeps end-to-end (mount every card at
least once, shaking lazy-load gremlins out), reset, then 25 measured full-extent
sweeps capturing every frame's churn, reported to the console (sweeps / frames /
p99 / p99.9 / max / mean / total nodes) and held briefly on the CHURN row.

Pre-culling baseline expectation: ~0 across all 25 sweeps. The number to defend
once culling lands is the per-frame churn during a full-extent warp — the live set
turning over as the camera transits.

**Recorded pre-culling baseline** (25 sweeps, 3,269 frames):

- churn p99 / p99.9 / max / mean / total: all 0.

Camera-path churn is zero, as predicted — pan and warp are pure transforms. For
contrast, the live ring's all-time `max` caught the initial mount at ~1,236 nodes
in a single frame (`replaceChildren` of ~618 cards ≈ 618 adds + 618 removes): the
commit/repack path, the expensive budget. Two paths on one readout: commit ≈ 1,236
nodes/frame, camera path = 0.

**Secondary finding — the warp sawtooth.** 3,269 captured frames over the ~41s
measured window is ~79 fps average against a 144 fps rest reading: framerate dips
through each warp's high-velocity middle and recovers at the ends, a sawtooth. With
churn at zero, that cost is pure paint/composite of ~618 live cards transformed at
speed — not DOM mutation. This is the render load spatial culling exists to remove,
now measured rather than asserted.

## Culling Checkpoint (first intervention)

Spatial culling is now built — the first real intervention from the design's
`scene model -> cull -> pool` spine. It is **retained-element culling**: every
card is built and packed once on the commit path (so the packer still measures real
heights/nudges), then the substrate records each card's world-x bounds and mounts
only the slice inside the viewport plus a one-viewport overscan. Cards leaving the
window are detached (not destroyed) and their element instances are kept, so a card
re-entering the window re-attaches its own content. This deliberately **defers
pooling**: with each element retained there is no shell reuse, so the recycler-flash
failure mode (design.md Pooling) cannot occur at this checkpoint.

What changed in code:

- `timeline.ts` gained a scene model (`scene[]` of `{id, el, left, right}` world
  bounds) and `mountedIds`; `reconcile()` runs on the camera path (inside
  `applyPan`) as pure arithmetic against precomputed bounds plus a few
  attach/detach ops — it reads no geometry, so it forces no reflow.
- `setScene()` arms culling (measures bounds once, post-pack); `setCards()` disarms
  it during the measure window so a stale scene is never reconciled.
- `visibility()` now reads the scene model, not the mounted DOM, so the gating
  measurement stays correct after the offscreen cards are unmounted. Its basis is
  now **horizontal**, matching the horizontal cull, so the live (mounted) set is
  `visible + near`.

Two consequences for the HUD readouts, to expect when re-measuring:

- **CARDS** stays 618 (total scene). **ONSCREEN** `visible / near / offscreen` now
  classifies the whole scene horizontally; mounted ≈ `visible + near`. **DOM** drops
  by roughly an order of magnitude (only the live slice is attached).
- **CHURN** is no longer zero on the camera path — it now measures the **cull
  turnover** as cards cross the window edges. This is the number the design said to
  defend (design.md Pooling / Move-To). Pan turnover is a few nodes per frame;
  full-extent warp turnover is higher (the live window sweeps the whole world) and
  is the F3 benchmark's new headline.

**Recorded post-cull baseline** (F3, 25 sweeps, 5,892 frames):

- churn p99 / p99.9 / max: 16 / 18 / 29 nodes/frame; mean 5.185; total 30,550.
- framerate: ~144 locked, only tiny dips (was ~79 fps sawtooth pre-cull).

The warp sawtooth is **gone**. Pre-cull the same 25-sweep / ~41s window captured
3,269 frames at ~79 fps average; post-cull it captures 5,892 frames at a ~144 fps
lock — the ~1.8x frame-count jump is the framerate recovery showing up
independently of the churn readout. That recovered cost was pure paint/composite of
~618 live cards transformed at warp speed; with the live set down to the viewport
window it is gone.

Camera-path churn is now non-zero but trivial: full-extent warp at up to ~1,400
px/frame turns the live window over for p99 16 / max 29 nodes per frame — two orders
of magnitude under the commit path's ~1,236-node mount, and cheap enough that the
144 fps lock holds straight through transit.

**Decision (gate resolved): culling alone meets the budget.** Per the checkpoint
strategy this is the success case where the spine stops early. The conditional
follow-ups do **not** open on this evidence:

- shell **pooling** is not built — retained-element culling already holds the
  framerate with trivial churn, and skipping it keeps the recycler-flash failure
  mode off the table entirely;
- **warp endpoint-materialization** is not built — warp transit churn is trivial,
  so there is no fast middle to stop materializing;
- LOD, imposters, canvas, and WebGL remain closed.

These reopen only if a later trace (zoom, a larger bake, or a slower device) shows
the live window's paint or the cull turnover regressing past budget.

## Warp Speed

`warpTo` duration is capped at 1.5s for long distances. Representative
pixel-per-frame speeds:

| Warp distance | Duration | Avg px/frame @60 | Peak px/frame @60 | Avg px/frame @144 | Peak px/frame @144 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 4,000px | 1.187s | 56 | 105 | 23 | 44 |
| 10,000px | 1.430s | 117 | 219 | 49 | 91 |
| 25,000px | 1.498s | 278 | 521 | 116 | 217 |
| 50,000px | 1.500s | 556 | 1,042 | 231 | 434 |
| 100,000px | 1.500s | 1,111 | 2,083 | 463 | 868 |
| 163,073px | 1.500s | 1,812 | 3,397 | 755 | 1,415 |

Finding: long-distance warps move too fast for full card text/detail fidelity to
matter during transit.

## Initial Target If Offscreen Estimate Holds

If the measured offscreen ratio is close to the rough 97% estimate:

- reduce live timeline cards from 618 to roughly 40-60 with generous overscan;
- expect live DOM to drop by an order of magnitude before LOD/imposter work;
- validate culling + pooling before considering lower-detail representations.

## First Measurement Checklist

The first harness should capture:

- total timeline cards/renderables;
- visible cards/renderables;
- near-visible cards/renderables;
- offscreen cards/renderables;
- DOM nodes by surface and component family;
- nodes per card family;
- known scene budget;
- live renderer budget;
- interactive DOM budget;
- pack cost;
- initial render cost;
- pan cost;
- short and long `warpTo` cost;
- minimap seek cost;
- node churn;
- allocation/GC pressure.
