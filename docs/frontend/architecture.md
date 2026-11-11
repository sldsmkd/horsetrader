# Architecture

The keystone of the system: the driver that shapes everything, the two core
pillars, how data flows between them, and the contract with the ETL. Pair this
with [persistence.md](persistence.md) and [projection.md](projection.md) for the
pillars in detail.

## The driver: static data, client compute, no compute server

Every structural decision serves one principle:

> Do all the heavy lifting in the ETL, host the result as **static baked data on
> a CDN**, and push **all runtime compute onto the client**. The player pays
> their own compute; the dev never gets a server/compute bill.

There is **no server-side compute**. The one server is Unity's cloud-save worker
([`horsetrader.cloud/unity-sync`](../../horsetrader.cloud/README.md)): an
authenticated blob store that GETs/PUTs the player's plan document and nothing
else — it computes nothing and the planner works fully without it. Consequences
that should guide every choice:

- Anything expensive that *can* be precomputed belongs in the ETL bake, not the
  browser (reward tables, the timeline, EN-date predictions).
- Anything that depends on *user input* must be computed **in the browser**,
  because it can't be baked.
- **The performance budget is the user's device.** This is *why* the projection
  engine caches and separates expensive recompute from cheap queries.
- If a feature seems to need a server, rethink it as "bake it upstream" or
  "compute it client-side" before adding infrastructure. Cloud save cleared that
  bar only because sync across devices genuinely can't be done otherwise.

## The shape

```
   etl repo (Python)                static/ (deploy root, gitignored)        site repo (TS)
 ┌───────────────────┐            ┌────────────────────────────┐         ┌────────────────────────┐
 │ scrape · normalise │  bakes →  │ json/*.json     (data)     │  reads  │ core/  (pure logic)    │
 │ predict EN dates   │           │ img/**          (webp)     │ ──────▶ │   persistence          │
 │ (heavy lifting)    │           │ (schema → config/schema/)  │         │   projection (ledger)  │
 └───────────────────┘            └────────────────────────────┘         │ ui/    (raw DOM)       │
        the ETL owns this data; it is read-only to the site                └────────────────────────┘
                                                                            site build writes index.html
                                                                            + js/ into the same static/
```

The ETL (`horsetrader/`) and the planner (`horsetrader.site/`) sit side by side in
one monorepo but stay independent. **`static/`** is the deploy root:
the ETL bakes data (`json/`) + images (`img/`) there directly, and the site's build
writes `index.html` + `js/app.js` into the same tree; together they form the
deployable web root that ships to Cloudflare. There is no cross-repo handoff
file: a change needing both sides is scope creep — do the other side in a
separate, single-purpose session (see [../contract.md](../contract.md)).

## The two pillars

The whole foundation is two `core/` modules and the rule that connects them.

### Pillar 1 — Persistence: store the inputs

Persistence stores a **minimal set of user inputs** and nothing derived. Four
sections, separated by lifecycle: a dated **snapshot** of resources, slow-moving
**configuration**, per-banner **commitments**, and **favourites**. Detail in
[persistence.md](persistence.md).

### Pillar 2 — Projection / Engine: derive everything else

The engine is a pure fold: streams produce events from the bake + account state;
the coordinator folds them into a ledger, then runs a reconciliation pass for
commitments. The ledger is a list of **attributed, dated, signed resource deltas**.
Per-day subtotals and the cumulative running balance are folds over it. Lives at
`core/engine/`. Detail in [projection.md](projection.md) (fold invariants, ledger
model, performance) and [engine.md](engine.md) (stream model, coordinator API,
registry roster).

### The rule that joins them: persist inputs, derive the rest

Entries are facts; balances are always derived, never stored. Persistence holds
only what the user supplied; the projection engine recomputes everything visible.
This keeps the stored state tiny and migration-friendly, and the derived state
always consistent.

## Data flow

```
   inputs  (persistence  ⇄  in-memory state)
              │  on input change (the only expensive step)
              ▼
      coordinator.fold()  ── O(n) ──▶  ledger + cached balance series
                                          │  on scrub / hover (cheap, O(1))
                                          ▼
                                   views: timeline · tooltip · cursor balance · scrubber
```

Unidirectional. The expensive fold fires only when an input changes — never on
interaction. Scrubbing the date cursor is a lookup into the cached series, not a
recompute.

## One ledger → many views

The minimap/scrubber is the proof of the design: it is **not** new machinery. Its
balance line is the same cumulative running balance sampled coarsely; its
green/blue blobs are the *favourites* input placed on the date axis, coloured by
type. The detailed timeline, the per-day tooltip, the cursor balance, and the
scrubber are all **views over the one ledger and the one fold**. This is the core
payoff, and the reason the ledger is kept rich (see "deferred optimisation" in
[projection.md](projection.md)).

## Product stance: informs, never enforces

The planner shows consequences; it does not gate them. Balances are signed and
**allowed to go negative** — a negative balance is meaningful output (a pressure
point), never an error, never clamped. Its value over a spreadsheet is
**legibility**: making the *density of interest* and the *pressure points* in a
plan readable at a glance, with zero maintenance for the user. Optimise UI for
glanceable comprehension, not for exposing more numbers.

## Layering

```
ui/   ──depends on──▶   core/
core/ ──never imports──▶ ui/   (and never touches the DOM)
```

`core/` is pure, headless, testable: types, the bundle loader, persistence, the
projection engine. `ui/` is raw-DOM rendering and event wiring. Keep the arrow
one-directional and the ball of mud can't form. See
[conventions.md](conventions.md).

## Startup: the landing sequence

The first paint is staged so the player sees a live, dressed app immediately while
the expensive card build happens unseen. (Origin and rejected alternatives:
[12 Billion Yen Incident](../projects/12-billion-yen-incident.md).)

1. **Parse time, no network.** An inline `<head>` script preloads the saved oshi's
   icon (read from localStorage); the Plan/beta icons and today's scenario splash
   are preloaded too.
2. **Scaffold** (`ui/scaffold.ts`, from `main.ts` before the bundle fetch). Mounts
   the real timeline + minimap over the prebaked `BAKED_EXTENT` with no cards and a
   flat 0-balance line. Fail-soft. The extent and scenario schedule come from
   `core/bundle/landing.gen.ts`, generated from the bake by
   `scripts/gen-landing.mjs` in the Makefile `types` stage (which `build` depends
   on, so it can't ship stale).
3. **`mountApp`** replaces the scaffold. `refresh()` paints the cheap chrome —
   menubar, minimap balance line, axis — synchronously, and defers only
   `buildCards()` one frame (first mount only; later refreshes build inline).
4. **Reveal.** Cards build, pack and cull under a dark card layer
   (`timeline__cards--dark`; opacity doesn't affect geometry), then
   `Timeline.reveal()` fades them up over 150ms. Film-strip portraits fade in on
   image load.
5. **First-run tour**, a frame later, if the `firstrun` watermark is behind
   ([menu.md](menu.md#first-run-tazunas-tour)).

The ~0.5s card build is still one long task (TBT ~518ms); the sequence beats
*perception*, not the metric. Don't "fix" it by arming the cull earlier or baking
card heights without reading the project record first.

## The ETL contract

> The canonical, both-sides definition of this interface is
> [../contract.md](../contract.md). This is the site's view of it.

The site does not own the shape of the data — the ETL does. The site **derives**
its TypeScript types from a contract the ETL publishes: `academy.schema.json` /
`events.schema.json`, generated from the ETL's bake (from its typed `msgspec`
DTOs) so they can't drift, written to `config/schema/` (out of the deploy dir).
`npm run gen:types` compiles them into `core/bundle/*.gen.ts` (the only consumer
of the raw schema) — committed, never hand-edited, re-run when the ETL re-bakes a
changed shape. The site never re-polices data validity at build time — that's the
ETL's job; see [trust-and-failure.md](trust-and-failure.md).

The ETL is also the single source of truth for **all game-data values** — not
just the event timeline, but the parameters of streams the client generates
procedurally (e.g. the carats from a daily login). The client owns a procedural
stream's *cadence*; never its *numbers*. A game-data literal in client code is a
smell — that value belongs in the bake. This means the bundle must carry those
rates/parameters too; see the stream decomposition in
[projection.md](projection.md) and the rule in [conventions.md](conventions.md).

## See also

- [persistence.md](persistence.md) — pillar 1 in detail.
- [projection.md](projection.md) — pillar 2: fold invariants, ledger model, performance.
- [engine.md](engine.md) — pillar 2: stream model, coordinator API, registry roster.
- [catalog.md](catalog.md) — the entity query broker (a seam over the bundle, not a pillar).
- [conventions.md](conventions.md) — language, layering, DOM patterns.
- [trust-and-failure.md](trust-and-failure.md) — trust boundaries and failure model.
