# Conventions

Code conventions the site relies on. Most aren't linter-enforced — they're house
rules that keep the codebase predictable and stop it accreting into the ball of
mud the previous site became. Match the existing style; if something here is
wrong or stale, fix it rather than working around it.

Several of these are carried over deliberately from the ETL's `standards.md` —
the same engineering sensibility, in TypeScript.

## Language: full TypeScript

- **Everything is TypeScript.** No mixed JS/TS. Separation of logic from UI is by
  *layer*, not by language.
- **esbuild transpiles TS with zero config** — it strips types and does **not**
  type-check. So types never block the build.
- **`tsc --noEmit` is the only build-time check**, and it polices *our* code
  against the types — not the data. Run it in the `check` step / before deploy.
- **`strict` is on.** Prefer `unknown` over `any` at boundaries; `any` turns
  checking off and poisons everything it touches. Prefer union/literal types
  (`"R" | "SR" | "SSR"`) over `enum`.

## No framework — raw DOM by intent

There is no framework, and that's deliberate. To keep "raw DOM" from meaning
"imperative spaghetti", a few small conventions are mandatory:

1. **A tiny typed `h()` element helper.** Create elements with attrs/children
   through it; no `innerHTML` string soup. This also absorbs the DOM-typing
   friction (`querySelector` casts, etc.) in one place.
2. **Unidirectional flow: `state → render → DOM`.** A view function takes state
   and produces DOM. Don't reach in and imperatively mutate nodes from many
   places — that's the actual lesson frameworks teach, kept without the framework.
3. **A typed data-access layer.** Load the bundle once, parse into in-memory
   structures (id-keyed `Map`s), expose query functions. UI code never touches
   raw JSON — it asks `getCharacter(id)`.
4. **One known home for state, no global grab-bag.** Each module exports a named
   surface; the DOM is never the source of truth for state.

## Layering

```
ui/   ──depends on──▶   core/
core/ ──never imports──▶ ui/   (and never touches the DOM)
```

`core/` (types, bundle loader, persistence, projection) is pure and headless.
`ui/` is rendering and event wiring. The one-directional arrow is the single most
important rule for preventing mud. This mirrors the ETL's hard ownership
boundaries — don't smuggle DOM code into `core/` to "co-locate" it.

## Game-data values live in the bundle, never in code

The ETL is the single source of truth for **all game-data values** — including
the parameters of streams the client generates procedurally (daily-login carats,
weekly-login amounts, daily-pack rewards, …). The client may own a stream's
*cadence* (the recurrence rule); it must **never** own its *numbers*.

**A game-data literal in client code is a code smell.** If you find yourself
writing `+ 50` for daily-login carats, that `50` belongs in the bundle, baked by
the ETL from upstream. The fix is never "hardcode it here" — it's "the value
should be baked." This keeps values in one place, lets a game rebalance flow
through a re-bake with zero site redeploy, and is the same upstream-ownership rule
as everything else (see [architecture.md](architecture.md)). The client has
*logic*; the ETL has *data*. See the stream decomposition in
[projection.md](projection.md).

## Comments and docstrings

Carried from the ETL standards:

- **Default to no line comments.** Reach for one only when *why* is non-obvious —
  a hidden constraint, a workaround, a surprise. Don't narrate *what* the code
  does; identifiers say that.
- **Don't reference tasks, PRs, or callers** ("added for X", "used by Y") — they
  rot.
- **Module / type doc comments document the contract**, not the implementation:
  what it promises, the invariants callers can rely on, the boundaries with other
  modules.

## Add complexity only when warranted

Start with the simplest thing that works and add structure when a real need
appears, not in anticipation. Examples already decided this way: plain state
object before any reactive store; full recompute (full scan) before incremental
recompute; on-disk == in-memory before a packed serialize boundary. See the
deferred optimisation in [projection.md](projection.md) for the canonical
"tempting, but it closes possibility space — wait" case, and the anchor-boundary
warning there for why incremental recompute in particular is *not* a freebie.

## Build & tooling

- `npm run dev` — esbuild dev server (serves the combined web root from
  `../generated/site`, with live rebuild).
- `npm run build` — minified bundle into `../generated/site/js/app.js`.
- `npm run deploy` — `wrangler pages deploy ../generated/site` (Cloudflare Pages).

Source lives here in `src/` (and `index.html` / `css/`); build output deploys
into `generated/site/` alongside the ETL's `img/` + `static/`. **Never hand-edit
anything in `generated/site/`** — it's all generated, by the ETL or by our build.

## See also

- [trust-and-failure.md](trust-and-failure.md) — the trust boundaries and failure
  tiers these conventions assume.
- [architecture.md](architecture.md) — why the layering and the driver are shaped
  this way.
