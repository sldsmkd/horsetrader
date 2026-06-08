# Entity query broker

A thin **query seam** over the bundle so UI components ask for *what they want*
(search results, a label, an image, the events featuring a card) instead of
reaching into raw records and re-deriving joins themselves. Pure `core/`, no DOM.
Tracked as **#35**.

> Status: **small, mostly a consolidation.** Not a new pillar — a seam one notch
> above the `Bundle` loader. The work is moving logic that already exists (in
> `ui/search` and `ui/oshi`) behind one intent-named surface.

## The actual problem (and the one it is *not*)

The smell is **components own query logic and know the bundle's shape.**
[../../horsetrader.site/js/src/ui/search/index.ts](../../horsetrader.site/js/src/ui/search/index.ts)
and [../../horsetrader.site/js/src/ui/oshi/index.ts](../../horsetrader.site/js/src/ui/oshi/index.ts)
each reach into `Bundle`, then independently re-implement `normalize()`
(byte-identical), a prefix-word ranking, a support/trainee → character join, and
label construction. A future banner card and an account-config surface will reach
for the same joins. A component that does `bundle.support(id)` +
`bundle.character(...)` + builds a label knows far too much about data layout.

It is **not** a missing object graph. We explicitly considered, and rejected,
reconstructing the ETL's linked-entity graph (identity map, hydration, recursive
`match`, `appearances` back-edges) on the client. The reasons it earns no keep:

- **No consumer needs graph traversal.** The most relationship-heavy planned
  feature — favourite a specific card, see every banner that contains it — is a
  flat filter (below). Nothing on the timeline traverses entity↔entity links.
- **It would fight the core driver.** [architecture.md](architecture.md) says do
  the heavy lifting in the bake. A runtime match-graph *reconstructs* relationships
  the bake can flatten (denormalised search terms are already partly baked as
  `aliases`). If search ever needs more reach, the move is to **bake more onto the
  record**, not to grow client machinery.
- **It violates house style** — work-from-the-back, explicit-over-trivial-DRY,
  and L1's own "defer until the second consumer shows the shape." A graph is the
  opposite of the smallest primitive that removes the literal duplication.

So the broker is the *right-sized* version of the instinct that produced the
graph: a seam, not a domain model.

## Worked example: favouriting a card

"Star the summer Maruzensky SSR support, and every banner containing *that exact
card* (not other Maruzensky cards) shows up on the bookmark axis" is, in full:

```ts
bundle.all().filter(e => e.contents?.includes(key))
```

Card-level precision is **free**: `contents` already holds the exact stable key,
so matching the key gives "that card, not the character" with no disambiguation
logic and no back-edge — a one-line scan over ~800 events. This is the feature
that might have justified a graph; it dissolves into a filter, which is why the
broker carries it as a method and the graph is dropped.

## The surface

Intent-named queries; the seam owns the *how* (normalisation, ranking, the
`contents.includes` filter, the character join):

```
searchEntities(query)      → ranked support/trainee matches (+ first appearance)
eventsFeaturing(key)       → every event whose contents include this exact key
label(key)                 → display label in the game's naming grammar
image(key)                 → icon / portrait / thumbnail for a key
```

Internally these compose the `Bundle` primitives that already exist
(`support`/`trainee`/`character`/`all`, resolve-or-throw). No hydration, no
identity map, no link pass — the bundle stays flat; the broker just stops every
component from re-deriving the same lookups.

## Shape and boundary

A thin **`core/query`** module that *takes* a `Bundle` and exposes the intents
above. Kept separate from `Bundle` (rather than bolted onto it) because `Bundle`
is scoped to "parse once into id-keyed typed access," while ranked search and
label/image resolution are **view-model prep** — a notch up, and independently
testable against a fixture bundle. Layering is unchanged: `core/query` is pure and
headless; `ui/` consumes it; persisted state still references entities by stable
**key** (the broker resolves keys to display, it is not the store).

## Build

- **Now (frontend):** introduce the seam by moving the existing `ui/search` and
  `ui/oshi` lookups behind it and de-duplicating `normalize()`. Small, removes the
  one literal duplication, and gives later features a home instead of more raw
  reaches.
- **When favouriting lands:** add `eventsFeaturing(key)` (the filter above) — it
  slots into the existing seam rather than reaching into the bundle again.
- **If search ever needs more reach:** denormalise onto the baked records
  (haystack terms, first-appearance) rather than building client-side relationship
  machinery. That is an ETL/contract change — a separate, single-purpose session;
  note it in [../contract.md](../contract.md) if taken.

## See also

- [architecture.md](architecture.md) — the two core pillars and the driver this seam respects.
- [trust-and-failure.md](trust-and-failure.md) — resolve-or-throw, trust the bake.
- [../contract.md](../contract.md) — the bundle interface; where any denormalisation would be recorded.
