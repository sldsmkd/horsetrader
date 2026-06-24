# The 12 Billion Yen Incident — get the horse out of the gate clean

> Sponsored by Gold Ship. Codename thesis: **the start.**
> Gold Ship reared in the gate, started ~5s late, lost an insurmountable lead.
> The site does the same: it builds the entire race before it leaves the gate.

## The symptom

Production speed test (horsetrader.site/, 2026-06-24, Desktop):

| Metric | Value | Band |
|---|---|---|
| TTFB | 37ms | green |
| FCP | 400ms | green |
| LCP | 1,042ms | green |
| TTI | 1,044ms | green |
| **Total Blocking Time** | **518ms** | **RED** |
| Speed Index | 1,560ms | amber |
| CLS | 0.02 | green |

Score 75, capped purely by TBT. The paint is fine; the **main thread panics in the gate** —
one long synchronous task after the pixels are up.

## The diagnosis

The bundle is 147KB min / 48KB gzip — parse/eval ~40ms, not the culprit.
The long task is the **startup render path**, `mountApp → refresh()`:

`js/src/ui/app.ts:321-344`

1. Build card data for the **entire multi-year extent** (835 event records, ~484 carded).
2. **Materialise a DOM element for every card** — `below.map(belowCard)` + `above.map(bannerGroup)`.
3. Mount the whole lot — `tl.setCards([...])` → `culling.mountAll(elements)`.
4. **Pack both lanes** — `packBelowLane`/`packAboveLane` *measure heights*, forcing a full reflow over every card.
5. **Only then** arm the cull — `tl.setScene(...)` → `culling.arm(...)` → cull down to the visible window.

The retained-element cull (Trackblazer, holds 144fps through warp) is real — it's just **armed one
step too late**. The packer's measure-all pass is the reason it can't arm earlier:
`timeline.ts:475-481` — *"the shell needs every card laid out so the packer can measure it."*

## The fix (Kris's call: "bake the landing screen as part of the pipeline and cull offscreen")

Move the layout the runtime currently *computes at the gate* into the **build pipeline**:

- The pipeline pre-resolves the **today-centred landing window** — the cards in it AND their packed
  positions/lane depths — so the runtime no longer needs mountAll→measure to learn its layout.
- Runtime mounts **only the landing neighbourhood**, arms the cull on frame 1, and offscreen cards
  never materialise until the cull asks for them.

This dissolves the mountAll↔packer coupling: with baked layout, `setCards/mountAll` stops being a
prerequisite for `setScene`.

## The load-bearing assumption to TEST first

**Is pack layout bakeable?** The packer measures real DOM heights (fonts, wrapping, CSS).

- If card heights are deterministic / content-derived and stable → bake exact depths, simple win.
- If heights wobble with font/viewport → bake per-card heights and have the packer **trust** them
  instead of measuring; OR bake an approximation and let the cull correct as cards scroll in.

Resolve this before committing. Everything else follows from the answer.

## Progress

- **Piece 1 — menubar paints early (DONE).** `app.ts` mounted the chrome and then ran the
  heavy `refresh()` in the *same* synchronous task, so the menubar (already holding the folded
  numbers — built with `coord.balanceAt(now)`) was held hostage behind the ~518ms card build and
  the player saw `Loading…` the whole time. Fix: `renderSurfaces()` then
  `requestAnimationFrame(() => setTimeout(refresh))` — paint the populated chrome frame first,
  materialise cards in the next task. Perceived-load win only; TBT unchanged (refresh is still one
  long task). `Loading…` → a real frame.

## Open questions

- "Landing screen" granularity: just the visible window's cards, or full baked pack layout for all
  835 (so any first warp is also measure-free)?
- Where does the bake live — ETL (Python, root) emitting layout, or a build-time TS pass in
  `horsetrader.site/scripts`? The render logic (belowCard/bannerGroup heights) is TS, so a TS
  build-time pass likely avoids duplicating render rules in Python.
- Does FCP regression risk exist if we inject baked markup into index.html? (Probably not — keep it
  data, not HTML, and let JS mount the window.)
