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

This estimate needs instrumentation before it becomes a baseline.

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
