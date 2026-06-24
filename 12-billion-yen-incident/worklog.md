# 12 Billion Yen Incident — worklog

> Skunkworks. Sponsored by Gold Ship. Thesis: **the start** — get the horse out of the gate clean.
> Gold Ship reared in the gate, started ~5s late, lost an insurmountable lead. The site does the
> same: it builds the entire race inside the gate before it leaves. See [spec.md](./spec.md).

## The target

Production speed test (horsetrader.site/, 2026-06-24): score **75**, capped by the lone red metric
**Total Blocking Time = 518ms**. Everything else green/fast (TTFB 37ms, FCP 400ms, LCP 1042ms,
CLS 0.02). The paint is fine; the main thread panics in the gate — one long synchronous task after
the pixels are up.

## Root cause

`app.ts → mountApp → refresh()` (`app.ts:284-345`) materialises a DOM element for **every card
across the whole multi-year extent** (835 records, ~484 carded), mounts them all, packs both lanes
(measuring heights → full reflow), and *only then* arms the retained-element cull
(`tl.setScene`, `app.ts:341`). The Trackblazer cull is real but armed one step too late; the
packer's measure-all pass (`timeline.ts:475-481`) is what forces the full mount.

## Plan — piece by piece

The approach (Kris's call): **bake the landing screen as part of the pipeline, cull offscreen.**
Move the layout the runtime computes at the gate into the build pipeline; mount only the
today-centred window; arm the cull on frame one so offscreen cards never materialise.

Broken down:

1. **Menubar paints early** — split the synchronous mount block so the chrome shows before the
   card build. Perceived-load win, independent of the rest. ✅ DONE (see below).
2. **Cull from frame one** — arm the cull *before* the mass mount so only the landing
   neighbourhood materialises. The real TBT kill. Blocked on (3).
3. **Bakeable pack heights** — the packer measures real DOM heights, which is why it needs the
   full mount. To skip that, card heights must be known without measuring. Load-bearing
   assumption: the world chrome is glass-unit normalised, but **cards are not** — `bannerGroup`
   is `height:auto`/`max-height:5.5rem`, `belowCard` is rem + wrapping text (`belowCard.css`,
   `bannerGroup.css`). So either (a) quantise cards to integer glass-u so height becomes a
   bakeable count [recommended], or (b) bake measured px heights via a build-time render pass.
   UNRESOLVED — decide before building piece 2.

## Log

### 2026-06-24 — kickoff + piece 1

- Established thesis ("the start" = startup TBT, not runtime fps; distinct from UmaMark).
- Diagnosed: bundle is 147KB min / 48KB gz (~40ms parse, not the culprit). The long task is the
  synchronous `refresh()` card materialisation + measure-all pack.
- Confirmed the cull is armed too late and the packer's measure-all is the coupling that forces it.
- Found cards are NOT glass-unit-quantised today (the bakeability assumption is real work, not free).
- **Piece 1 shipped:** `app.ts:831` mounted chrome then ran the ~518ms `refresh()` in the *same*
  task, so the menubar (already populated — built with `coord.balanceAt(now)`, fold done in
  bootstrap) was held behind the card build and the player saw `Loading…` the whole time. Changed
  to `renderSurfaces()` then `requestAnimationFrame(() => setTimeout(refresh))`: paint the populated
  chrome frame first, build cards next task. tsc green. Verified `renderSurfaces` has no dependency
  on `refresh()` output. Perceived-load only — TBT unchanged (refresh still one long task).

### 2026-06-24 — piece 1b: menubar oshi portrait preload

- With the menubar painting early, its images lagged behind it. The only always-visible menubar
  image is the **oshi portrait** (`/img/characters/<slug>_icon.webp`, dynamic per saved oshi);
  home is an emoji, tablet/hammer are hidden by default.
- The avatar URL is derivable without the bundle: saved oshi is `remote.config.identity.oshiId`
  (`"char-<slug>"`), icon is just the slug (`oshi.ts`). Added a tiny inline `<head>` script in
  `index.html` that reads localStorage and injects `<link rel=preload as=image>` for the real saved
  oshi (falls back to haru), so the fetch starts at parse time — before `app.js` fetches the bundle
  — and the portrait lands with the menubar. try/catch'd; any miss just 404s a harmless preload
  (the real `<img>` src is unaffected). No CSP. `cp index.html` into static.
- Extended to also preload the **Plan tablet** (`/icons/tablet.png`) — but only when the saved blob
  has commitments (`remote.commitments` non-empty), since the tablet is hidden otherwise. Reuses the
  already-parsed blob, so no-commitment visitors don't fetch an icon they won't see. Hammer
  (supporter-gated, rarely shown) left alone.
  - NOTE (separate change, Kris): the Plan tablet *should* show always, not gate on commitments.
    When that lands, drop the `remote.commitments` guard here and preload tablet unconditionally.
  - UPDATE (same session): made it so. Tablet + hammer are tiny, so preload both unconditionally as
    plain static `<link rel=preload>` (cached/decoded if/when revealed); the inline script now only
    handles the dynamic oshi.

### 2026-06-24 — piece 2 foundation: prebaked extent + pre-fetch landing scaffold

The "bake the landing screen" thesis, first real cut: paint the timeline + minimap *structure*
before any network, from data available at parse time.

- **Prebaked proxy extent.** New `scripts/gen-extent.mjs` reads the baked `events.json` and emits
  `js/src/core/bundle/extent.gen.ts` → `BAKED_EXTENT = { start, end }` (earliest→latest shown event
  start, UTC date; proxy — the real layout re-buckets). Wired into the Makefile `types` stage
  (after bake) + `npm run gen:extent`. Current span: 2025-06-26 → 2029-03-26.
- **Scaffold mount.** New `js/src/ui/scaffold.ts` `mountScaffold(now, root)`: constructs the real
  `timeline` + `minimap` views (both standalone — no coordinator, no global listeners so they GC on
  replace), lays them over `BAKED_EXTENT` with empty cards and a flat 0-balance line. Called in
  `main.ts` *before* the fetch, fail-soft (try/catch — a scaffold hiccup never blocks the boot). The
  real `mountApp` replaces the whole #app subtree when the bundle lands.
- **Minimap.scaffold().** New view method: frets (`fretLevels()`, no fold needed) + a full-width
  blue positive band + flat line on the origin fret. No bundle → no dots (boxes deferred to the
  fold, per the appearance-index decision: not worth the bundle bytes now).
- **Blue at >= 0.** Changed the real minimap band threshold `midpoint > 0` → `>= 0`, so a flat-0
  plan reads blue ("in the black") instead of blank. Kris's call; affects the live minimap too.
- tsc green; 19 minimap/pack tests pass.
- Deferred: boxes (need a prebaked appearance index to place pre-fetch).
- REJECTED: putting the menubar (top bar) in the scaffold. It paints at mountApp (post-fetch); the
  gap before it appears is imperceptible to the eye, so a placeholder bar isn't worth it. Don't
  re-raise.

### 2026-06-24 — fix: minimap blanked after the scaffold handoff

- Symptom: minimap painted correctly (scaffold), then blanked, then repainted.
- Cause: piece 1 deferred the *entire* `refresh()` a frame. So `mountApp` swapped the scaffold
  views for fresh, unpainted ones, and the new minimap sat blank until the deferred refresh ran.
- Fix: split `refresh()` — extracted the expensive card build into `buildCards()`; `refresh` now
  paints the cheap chrome (minimap/strip/timeline axis) synchronously and defers only `buildCards`
  one frame, on first mount only (later refreshes build inline so toggles/commits stay immediate).
  The mount call went back to a plain `refresh()`. Now the new minimap paints its *real* balance
  line in the same frame as the swap — scaffold flat-blue → real, no blank. The card build is still
  deferred past the first paint (the gate). tsc green.

### 2026-06-24 — scenario splash preload + generator rename

- Symptom: the app resolves "today = Trackblazer" fast, but the big scenario splash (the wallpaper)
  loads late and pops in.
- The displayed image is `art ?? image` (the full splash, select/scenario.ts:48); the active
  scenario is the latest launch `start <= now` (with a 4-day incoming ramp). All prebakeable.
- Generator broadened from extent-only to landing-screen data: `gen-extent.mjs` → `gen-landing.mjs`,
  `extent.gen.ts` → `landing.gen.ts`, exporting `BAKED_EXTENT` + `BAKED_SCENARIOS` (`{start,image}`
  schedule, image = the big splash). npm `gen:landing`, Makefile `types` stage updated.
- `scaffold.ts` now resolves today's scenario (mirroring scenarioLookup's active+ramp pick) and
  injects a `<link rel=preload as=image>` for its splash at parse time — warm before the app mounts
  it. For 2026-06-24 → scenario-03.webp (Trackblazer, 88KB).
- Considered a thumb→big progressive swap; Kris: "just show the real art" — so we preload the full
  splash directly, no thumb stage, no scenarioArt change. tsc green.

### 2026-06-24 — film strip: fade faces in (Fuji-Kiseki stage magic)

Kris's reframe: stop trying to be perfect (capturing heights etc.); use *diversion* — mask the pop
instead of eliminating it. Observed the film strip's (unintentional, pleasant) entrance:

- **Start:** `refresh()` → `track.replaceChildren(...capsules, ...frames)` paints the coloured
  capsule blocks left-justified (index geometry from x=0), then `settle()` sets `translateX`, which
  the CSS `transition: transform 160ms ease-out` (filmstrip.css:42) glides — the "push right + around".
- **End:** two clocks. The slide ends deterministically at ~160ms. The faces (`<img loading=lazy>`)
  pop in on their *own* unbounded schedule (cache/network) — the worst of the pop, uncatchable by a
  fixed-duration curtain.
- **Fix:** load-triggered fade on the portraits only. `filmstrip.ts` adds `--loaded` on the img's
  `load` (or synchronously if already `complete`); CSS starts the portrait at opacity 0 and
  transitions 280ms to 1 (past faces to 0.5). Cached faces reveal before first paint → instant, no
  transition; first-load faces fade as they decode. Capsule blocks + glide stay crisp. tsc green.

### 2026-06-24 — the star: raise the stage lighting on the cards

The finale, same diversion philosophy. Don't optimise the ~0.5s card build — let it finish, then
fade the cards in. The timeline substrate (line, today marker, rail) is the always-lit **stage**;
the cards are the **lead**, spotlit only once ready.

- New `Timeline.reveal()`: the card host (`timeline__cards`) starts with a `--dark` class (opacity
  0, added at construction); `reveal()` removes it → CSS `transition: opacity 150ms ease-out` fades
  the layer up. Opacity doesn't affect geometry, so the build/measure/pack/cull all run *under* the
  dark layer — exact, just unseen.
- `app.ts buildCards` calls `tl.reveal()` after `setScene`. First mount (deferred a frame) fades up;
  later rebuilds mount into the already-lit layer → instant (one-way, idempotent).
- Net landing experience: stage (pre-fetch scaffold: timeline + minimap frets + flat blue line) →
  chrome + real minimap balance line (sync at mountApp) → cards fade up 150ms when built. The 518ms
  TBT is unchanged (we're masking, not optimising — Kris's call: "beating human perception"), but
  the player never sees a blank or a hang; the stage is always dressed.
- tsc green; 19 tests pass.

NOTE: Kris mentioned "the cards and uptick" as the lead — the minimap balance line ("uptick")
currently appears synchronously with the chrome (no fade), already gap-free. Left un-faded; revisit
if the line should rise *with* the cards.

## Verdict — DONE 2026-06-24

Kris: *"there's no next step, no piece 3, it's perfect — you see the app straight away and there's
enough transitioning and things to look at you don't notice the work it's doing behind the scenes
to get ready."*

The thesis ("the start") was solved by **diversion, not optimisation**. We never touched the 518ms
card-build long task. Instead:

1. Prebaked the landing data (extent + scenario schedule) so the **stage** (timeline + minimap
   frets + flat blue line) paints from parse, zero network.
2. Preloaded the menubar images (oshi, tablet, hammer) + today's scenario splash at parse.
3. Split `refresh` so the real chrome (menubar, minimap balance line, axis) paints synchronously,
   deferring only the card build.
4. Staged fade-ins that read as feedback, not waiting: film-strip faces fade in on decode; the
   cards (the **lead**) build under a dark layer and the lighting rises 150ms when ready.

The player sees a live, transitioning app immediately; the gate-work happens unseen behind the
performance. TBT-the-number is unchanged by design — we beat **perception**, which was the goal.

### Abandoned (deliberately, not deferred)
- **Piece 2** — arm the cull before the mass mount. Not needed; the dark-layer reveal masks the
  build.
- **Piece 3** — bake/quantise card heights to skip the packer's measure-all. Not needed; we let the
  packer measure under the dark layer (opacity doesn't affect geometry).
- The bookmark **boxes** prebaked appearance-index, and the **menubar in the scaffold** — both
  imperceptible gaps, not worth the bytes/effort.
