# Interaction (the view-layer architecture)

How the interactive `ui/` layer is *built* — the wiring that turns the
intent in [ui.md](ui.md) into running code. Where [ui.md](ui.md) describes the
system **from the user's perspective** (what each surface is *for*), this doc is
the **implementation detail in service to it**: the layers, the seams, and the
data-flow that the surfaces are rendered through.

It sits on top of `core/` (persistence + projection) and is a pure consumer of
the **coordinator seam** ([coordinator.ts](../../horsetrader.site/js/src/core/coordinator/coordinator.ts)).
Pair with [conventions.md](conventions.md) (the `h()`/no-framework/unidirectional
rules this doc makes concrete) and [projection.md](projection.md) (the perf split
the two-tier change model below is the UI expression of).

## Status: loop proven, foundation in; surfaces next

As of **2026-06-03** `core/` is built and tested, [ui.md](ui.md) has captured
every surface intent-first, and the view layer's foundation is in: **build-order
steps 1–3 are done.** The **`h()` helper + `qs()`** and the **formatter**
(`format.ts`) — step 1; the coordinator **notify seam** (`subscribe`) and the
**discrete view-state store** (`state/viewState.ts`) — step 2; and the first
**DOM views through the whole one-way loop** — the cursor balance readout
(`views/cursorBalance.ts`) and a floating **Account overlay** (`views/overlay.ts`)
toggled from a menubar, all wired by the **app shell** (`app.ts`). Proven end to
end against the real baked bundle, exercising **both broadcast stores**: the
coordinator (snapshot edit → recompute → `subscribe` → render; scrub → direct
`balanceAt` write, no broadcast) *and* the view-state store (menubar → `set` →
`subscribe` → mount/unmount the overlay), the canvas staying live behind the
overlay (principle 1, via a `pointer-events: none` layer). The two stores compose
independently — editing carats in the overlay refreshes the canvas behind it while
the overlay stays open. Still to come: the timeline substrate, the selectors, and
the packer (step 4) — the real work. Read the rest of this doc as the architecture
those will follow, not yet a full map of current `src/`.

## The layer cake

Four layers; each depends only on the ones below it, nothing reaches back up
(the `ui/ → core/`, never-reverse rule from [conventions.md](conventions.md),
applied *within* `ui/` too):

```
app shell      wires it together; owns the render loop & the subscriptions
  └─ views        pure (props) → HTMLElement        — the element "factories"
       └─ selectors   pure (projection, bundle, ui-state) → view props
            └─ primitives   h() · one formatter · typed bundle data-access
```

- **primitives** — the irreducible foundation:
  - **`h()`** — the tiny typed element helper ([conventions.md](conventions.md)).
    All DOM is created through it; no `innerHTML` string soup. It also absorbs the
    `querySelector`-cast friction in one place.
  - **One formatter** — the *single* home for turning a signed resource number
    into display text (sign, label, grouping). [projection.md](projection.md) is
    emphatic: the engine holds `-50`; exactly one formatter decides how it reads.
    (The prototype's `+-50` bug was sign-prefixing an already-negative value in
    one of many ad-hoc spots — one formatter is the fix.)
  - **Typed bundle data-access** — load the bundle once, parse into id-keyed
    `Map`s, expose `getCharacter(id)`-style queries. UI never touches raw JSON.

- **selectors (view-models)** — the real "bridging logic", and the layer your
  intuition called *adapters*. Pure functions: `(projection, bundle, ui-state) →
  view props`. They resolve ids to entities, attach the per-date subtotal, compute
  the true-date x — everything between "the ledger" and "what a card needs". They
  hold **no DOM and no state**, so they get `core/`-grade tests even though they
  live in `ui/` (this is where view-layer correctness is proven; see
  [conventions.md](conventions.md) on why the test burden moves earlier on the
  user's machine).

- **views** — `(props) → HTMLElement`, built from `h()`. Dumb on purpose: no data
  fetching, no cross-view reach, no state. Given props, return nodes.

- **app shell** — the *only* place that knows about wiring: it owns the render
  loop, subscribes to the stores, and mounts/unmounts overlays over the always-live
  timeline (principle 1, [ui.md](ui.md)).

**What you do NOT build:** a domain adapter. The coordinator already *is* the
headless domain seam — it owns the plan, runs the one recompute, and exposes
`projection()`, `balanceAt()`, `document()`, `channels()`. You build on it, you
don't wrap it.

## The two seams to add around the coordinator

The coordinator is complete as a *domain* surface but the interactive layer needs
two small pieces it doesn't yet have.

### 1. A notify seam (subscribe, never fan-out)

Principle 7 in [ui.md](ui.md) is explicit about the prototype's actual mud: a
manual `refresh()` fan-out — one mutation hand-calling
`setSpend → buildProjection → refreshTimelinePulls → sidebar.refreshPulls →
navbar.refresh → minimap.refreshBalance`, where adding a view meant editing that
chain forever. The cure is **subscription**: views register interest once and are
notified after each recompute; **no view ever touches another view**.

The coordinator's `update()`/`setEnabled()` already recompute, but notify nobody.
Add the observer:

```ts
subscribe(listener: () => void): () => void   // returns an unsubscribe
```

`update()` and `setEnabled()` invoke the listeners after they swap in the fresh
projection. A bare callback is DOM-agnostic, so this stays inside the headless
coordinator without breaching the layering rule.

**The contract to pin, and its negative.** The seam has a behavioural invariant
worth a `core/`-grade test (it's headless, so it gets one): subscribers fire on a
**mutation** and stay **silent on a read**. The cheap-query path — `balanceAt()`,
`projection()`, `document()` — must notify *nobody*; only `update()`/`setEnabled()`
do, and **exactly once** per call. Assert both directions with a counting spy:
reads leave the count at `0` (the negative — this is what proves the scrub path is
broadcast-free), a mutation bumps it to exactly `1` (the positive — guards the
accidental double-notify that silently doubles render work).

```ts
coord.subscribe(() => notals++);
coord.balanceAt(d); coord.projection(); coord.document();  assert.equal(notals, 0);
coord.update({ snapshot });                                 assert.equal(notals, 1);
```

> This "reads never notify" is the **current** rule, and the test guards it
> deliberately so any future change is a conscious one. A read that *does* need to
> notify (e.g. a lazily-derived surface) is conceivable later — but that's a
> decision to make on purpose, with the test updated to match, not a thing to leave
> ambiguous now.

**The other half of the split needs no test — it needs an absent API.** The
"transient interaction-state has no broadcast" guarantee (§2 below) is *structural*,
not behavioural: you cannot assert the absence of a `subscribe` at runtime, and a
test that tried would be a tautology — or worse, would imply a path exists to
guard. Enforce it by simply **not putting `subscribe` on the transient store's
type**; the compiler is the proof. Prove the negative where it's testable (reads
don't notify); enforce it where it isn't (no API to misuse).

### 2. View-state, split by frequency (ephemeral, never persisted)

The coordinator holds **domain** state. Everything else interactive is **not
domain and must never be persisted** — but it does **not** all belong in one
store, and conflating it is exactly how a scrub gets accidentally routed through
rendering. Split it by *update frequency*, because that maps one-to-one onto the
two-tier change model below:

- **Discrete view-state** — `overlayOpen`, current selection, the search query.
  Changes are **rare** and **many views care**, so this gets a small store with a
  render-triggering `subscribe`, the **same pattern** as the coordinator. A change
  here drives a re-render of the affected views.
- **Transient interaction-state** — the cursor/scrub date, the pan offset, the
  hover target. Changes are **continuous (many/second)** and **one or two elements
  care**. This deliberately has **no broadcast `subscribe` that the render loop
  attaches to.** It is owned by the interaction handlers and pushed **directly** to
  its handful of consumers on the cheap path (the canvas transform; the balance
  readout, which reads `balanceAt`). There is no `subscribe → render` to misuse,
  so a 60-Hz cursor move **structurally cannot** enter the render path.

So: **two broadcast stores** (coordinator + discrete view-state), **one pattern**
between them; plus transient interaction-state that is *not* a broadcast store by
design. The split is the guarantee — not call-site discipline you have to remember
six months from now. (The shared rule across all three: never read state back out
of the DOM — principle 7 — and never persist any of it; cursor position or
open-overlay in the plan would be the denormalisation smell
[persistence.md](persistence.md) warns against.)

> The one shared consumer to keep straight: the **balance readout** is updated by
> *both* tiers — the cheap scrub path (cursor moved, projection unchanged) **and**
> a coordinator recompute (cursor stationary, projection changed). Both call the
> same small update function; **neither is a full re-render.** That it answers to
> two triggers is fine — what matters is that the cheap one never broadcasts.

## The crux: two tiers of change

This is the part a framework would hide, and the one most likely to bite — it is
the **UI expression of the perf split in [projection.md](projection.md)** ("cache
the fold, make the query cheap"). Not all changes are equal:

| | Trigger | Path | Frequency |
| --- | --- | --- | --- |
| **Domain mutation** | commit a pity, edit the snapshot, toggle a channel | `coordinator.update()` → recompute → notify → **re-render dependent views** | rare |
| **Discrete view change** | open an overlay, run a search, change selection | discrete view-state store → notify → **re-render dependent views** | rare |
| **Continuous interaction** | pan the timeline, drag the scrub cursor, hover | transient interaction-state → **direct targeted cheap DOM write** (no broadcast) | many/second |

Scrubbing must **never refold and never re-render**: it reads `balanceAt(date)`
(O(1) into the cached dense series) and writes one balance readout's text + a CSS
transform on the canvas. If you route a 60-Hz scrub through the domain-mutation
path you refold 60×/second and the app feels awful against the *user's-device*
budget that drives the whole architecture ([architecture.md](architecture.md)).
Keep the two paths visibly separate from day one.

## The packer: one pure, tested geometry module

Layout packing is the **one genuinely algorithmic chunk** of the UI (principle 8,
[ui.md](ui.md)), and it must be **contained**, not sprinkled as
`getBoundingClientRect` calls across views (the prototype's sprawl). The shape:

1. Render the cards, **measure heights once**.
2. A **pure geometry function** — `(x-positions, heights) → offsets`. No DOM, no
   measurement, just the packing math. **Headless-testable.**
3. Apply the result as transforms.

It is **one module with two lane strategies** (the asymmetry is correct —
different semantics, different data):

- **Above:** group-by-shared-start + horizontal nudge to fit; date on the group.
- **Below:** vertical collision-stacking (tallest-first, fill gaps); per-card date.

Treat it like a `core/` module that happens to live in `ui/`: pure in, pure out,
fully covered. The stems stay pinned to the true date even when bodies are nudged
(principle 4 — the UI deforms before it lies about *when*).

## Likely directory shape

Not prescriptive at field level (settled in code), but the layering above suggests:

```
js/src/ui/
  h.ts              the element helper
  format.ts         the one signed-resource formatter
  bundle/access.ts  id-keyed Maps + getX(id) queries  (or fold into core/bundle)
  state/viewState.ts   discrete view-state store (overlay/search/selection) + subscribe
  interact/*.ts        pan/scrub/hover handlers: own transient state, write directly (no broadcast)
  select/*.ts       pure view-models (+ *.test.ts beside them)
  pack/pack.ts      the pure packer (+ pack.test.ts)
  views/*.ts        (props) → HTMLElement
  app.ts            the shell: render loop, subscriptions, overlay mounting
```

`main.ts` stays the entry point ([main.ts](../../horsetrader.site/js/src/main.ts)):
fetch the bundle, build the coordinator, then hand both to the app shell instead
of stashing the coordinator on `globalThis`.

## Build order: prove the loop before the surfaces

Don't start with the timeline. Start with the smallest thing that exercises the
**whole one-way loop**, so the architecture is validated before surfaces pour into
it:

1. **`h()` + the formatter** — everything sits on these.
2. **The notify seam** on the coordinator + the small **discrete view-state**
   store with `subscribe` (the transient interaction-state has no broadcast — see
   the store split above).
3. **One trivial real view through the loop** — e.g. the cursor balance readout:
   on a domain recompute it re-renders via `subscribe`; on a scrub it is updated
   directly off `balanceAt` with no broadcast. That one view exercises **both**
   tiers of the change model — the cheap path and the render path — in the
   smallest possible space, proving the loop end to end with zero framework.
4. **Then the timeline substrate and the packer** — where the real work is.

This is the "add complexity only when warranted" rule ([conventions.md](conventions.md))
applied to bring-up: a thin vertical slice through every layer first, breadth
after.

## See also

- [ui.md](ui.md) — the surfaces this layer renders, from the user's perspective.
- [projection.md](projection.md) — the ledger/fold every view reads, and the
  cache/query split the two-tier change model mirrors.
- [persistence.md](persistence.md) — the plan the coordinator persists; why
  ephemeral view-state must stay out of it.
- [conventions.md](conventions.md) — `h()`, unidirectional flow, typed
  data-access, the no-framework discipline this doc makes concrete.
- [architecture.md](architecture.md) — the no-server / user's-device driver behind
  the two-tier change model.
