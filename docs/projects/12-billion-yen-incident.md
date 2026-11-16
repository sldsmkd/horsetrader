# The 12 Billion Yen Incident — get the horse out of the gate clean

Status: **done 2026-06-24.** Solved by *diversion*, not optimisation.

> Sponsored by Gold Ship. Codename thesis: **the start.** Gold Ship reared in the
> gate, started ~5s late, and lost an insurmountable lead. The site did the same: it
> built the entire race before it left the gate.

The durable result — the landing sequence — is documented in
[frontend/architecture.md § Startup](../frontend/architecture.md#startup-the-landing-sequence).
This page is the project record: what was wrong, what was tried, and what was
deliberately not done.

## The symptom

Production speed test (horsetrader.site, 2026-06-24, desktop): score **75**,
capped by one red metric.

| Metric | Value | Band |
|---|---|---|
| TTFB | 37ms | green |
| FCP | 400ms | green |
| LCP | 1,042ms | green |
| TTI | 1,044ms | green |
| **Total Blocking Time** | **518ms** | **red** |
| Speed Index | 1,560ms | amber |
| CLS | 0.02 | green |

The paint was fine; the main thread panicked in the gate — one long synchronous
task after the pixels were up.

## The diagnosis

The bundle (147KB min / 48KB gzip, ~40ms parse) was not the culprit. The long task
was the startup render path, `mountApp → refresh()`:

1. Build card data for the **entire multi-year extent** (835 event records, ~484 carded).
2. Materialise a DOM element for every card and mount them all.
3. **Pack both lanes** — the packer measures real heights, forcing a full reflow.
4. **Only then** arm the Trackblazer cull, culling down to the visible window.

The retained-element cull was real, just armed one step too late; the packer's
measure-all pass (it needs every card laid out to measure it) was the coupling
forcing the full mount.

## The original plan (and why most of it was abandoned)

Kris's first call: *bake the landing screen as part of the pipeline and cull
offscreen.*

1. **Menubar paints early** — split the synchronous mount so populated chrome
   shows before the card build. ✅ shipped.
2. **Cull from frame one** — arm the cull before the mass mount. ❌ abandoned.
3. **Bakeable pack heights** — cards are *not* glass-unit quantised
   (`bannerGroup` is `height:auto`, `belowCard` is rem + wrapping text), so heights
   would have to be quantised or baked by a render pass. ❌ abandoned.

Midway Kris reframed: stop trying to be perfect, **mask the pop instead of
eliminating it**. Pieces 2 and 3 became unnecessary.

## What shipped

1. **Prebaked landing data.** `horsetrader.site/scripts/gen-landing.mjs` reads the
   baked `events.json` and emits `core/bundle/landing.gen.ts` (`BAKED_EXTENT` +
   `BAKED_SCENARIOS`). Wired into the Makefile `types` stage, and `build` depends on
   `types` so a stale file can never ship.
2. **Pre-fetch scaffold** (`ui/scaffold.ts`). Before the bundle fetch, `main.ts`
   mounts the real timeline + minimap views over `BAKED_EXTENT` with no cards and a
   flat 0-balance line (`Minimap.scaffold()`); fail-soft. `mountApp` replaces it.
   The minimap band threshold changed `> 0` → `>= 0` so a flat-0 plan reads blue.
3. **Parse-time image preloads.** An inline `<head>` script in `index.html` reads
   the saved oshi from localStorage and preloads her icon; the Plan tablet and beta
   hammer are static preloads; the scaffold preloads today's scenario splash.
4. **Split `refresh()`.** The cheap chrome (menubar, minimap balance line, axis)
   paints synchronously; only the expensive `buildCards()` is deferred one frame,
   on first mount only. No blank minimap between scaffold and real view.
5. **Staged fade-ins.** Film-strip portraits fade in on image `load`; the card
   layer starts dark (`timeline__cards--dark`) and `Timeline.reveal()` fades it up
   150ms after `buildCards`. Build/measure/pack/cull run under the dark layer —
   opacity doesn't affect geometry.

TBT-the-number is unchanged by design: we beat **perception**. Kris's verdict:
*"you see the app straight away and there's enough transitioning and things to
look at you don't notice the work it's doing behind the scenes."*

## Deliberately not done — don't re-raise

- Arm the cull before the mass mount / bake card heights (pieces 2–3 above).
- A prebaked appearance index so minimap boxes paint pre-fetch — not worth the
  bundle bytes.
- A placeholder menubar in the scaffold — the gap before the real one is
  imperceptible.
- A thumb→full progressive swap for the scenario splash — "just show the real art".

Open nit: the minimap balance line appears with the chrome, unfaded. Revisit only
if it should rise *with* the cards.
