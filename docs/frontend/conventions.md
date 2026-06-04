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
- **Relative imports carry the `.ts` extension** (`./document.ts`, not
  `./document`). `tsc` (`allowImportingTsExtensions`) and esbuild both accept it,
  and it's what lets the test runner execute source files natively with **zero
  tooling** (see Testing). Extensionless bundler-style imports don't run under
  Node's native loader — don't reintroduce them.

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

## Styling: plain CSS, co-located per view

There's no CSS framework either, for the same reason there's no JS one — and the
same small disciplines keep "plain CSS" from becoming a specificity war:

- **BEM naming, flat specificity.** Every selector is a single class
  (`.minimap__fret--origin`, `.banner-group__date`); the rare contextual rule
  stays shallow (`.card--below .card__body`). No id selectors, no deep descendant
  chains, no `!important`. A flat specificity landscape is the no-framework cure
  for both diseases — escalation wars and action-at-a-distance. Inheritance is for
  *theme only* (`currentColor`, the `Canvas` system colour, `:root` custom props);
  class names carry structure explicitly.
- **One stylesheet per view, co-located and imported by it.** Each view module
  imports its own `.css` (`minimap.ts` → `import "./minimap.css"`); esbuild's CSS
  loader concatenates them through the JS import graph into the single `app.css`.
  Open a view and its styles are right there; delete the view and its CSS leaves
  with it. `css/base.css` holds only the page shell (`body`, `#app`) and tokens
  more than one view reads (`--minimap-h`); a genuinely shared primitive gets its
  own file imported by each user (`views/card.css`, the skeleton both lanes build
  on). This is the CSS face of the Layering rule above — co-locate by ownership.
  Note co-location is organisation, not isolation: the global namespace is still
  global, so BEM discipline is what actually prevents collisions. Reach for CSS
  Modules only if a real collision ever bites (per *add complexity only when
  warranted*).
- **CSS owns static layout and theme; JS owns geometry.** This is the load-bearing
  line — the thing that turns component CSS into mud in a canvas app is layout
  values leaking between the stylesheet and the render loop. Anything driven by the
  axis, pan, or packer math is set inline from JS (the timeline content `width`
  from the axis extent, the packer's `translateX` on a card/group); everything
  static — box model, colour, the anchor geometry (`transform: translateX(-50%)`
  that straddles a card on its tick) — lives in CSS. If you're tempted to write a
  fixed pixel into JS or a computed value into CSS, you're on the wrong side of
  this line.

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

## Testing: cover `core/`, because the user's machine has no dev watching

The ETL is happy to **blow up loudly** — it fails in a pipeline where the *dev*
is the audience and a `raise` is the right answer (see the three-tier model in
[trust-and-failure.md](trust-and-failure.md)). The site is the opposite end: it
executes on the **user's machine**, where no one is watching the console and a
silent miscalculation or a bricked save just *is* the bug. So the burden of
proving stability and correctness moves **earlier** — onto tests — for exactly the
foundational layers where it matters.

- **Pure logic is the test target — `core/` and the pure `ui/` modules; the
  DOM-touching layer is not.** `core/` is where most correctness lives
  (persistence integrity, projection arithmetic, the bundle loader) — test it
  well. The pure `ui/` modules that hold real logic but touch no DOM — the
  formatter, the view-state store, the packer, the selectors — are headless for
  the same reason and **are** tested too. What stays out of the net is the
  DOM-touching layer (`h()`, views, event wiring, the app shell): keep it thin
  enough to eyeball, and keep the logic in the pure modules so it's the part under
  test.
- **Zero test tooling.** Tests use the built-in `node:test` + `node:assert/strict`
  and Node's native TS type-stripping — **no Vitest/Jest/ts-node**, no transform
  step, no config. The only dep this needs is `@types/node` (so the test files
  stay inside the `tsc --noEmit` net). This is the "add complexity only when
  warranted" rule applied to the test stack itself.
- **`npm test`** runs `node --test` over `js/src/**/*.test.ts` — `core/` and the
  pure `ui/` modules alike. Tests live beside the code they cover
  (`persistence.test.ts` next to the module). A `*.test.ts` must import only pure
  modules; importing a DOM-touching one (`h()`, a view) would crash the runner
  (no `document`) — which is exactly the boundary, enforced by the runtime.
- **Pure `core/` is what makes this cheap.** Modules take their dependencies as
  arguments (e.g. persistence takes an injectable key/value store, so a test uses
  an in-memory one) rather than reaching for globals. That headless discipline —
  the same one the layering rule enforces — is what lets a test exercise the real
  logic with no DOM and no `localStorage`.

## Add complexity only when warranted

Start with the simplest thing that works and add structure when a real need
appears, not in anticipation. Examples already decided this way: plain state
object before any reactive store; full recompute (full scan) before incremental
recompute; on-disk == in-memory before a packed serialize boundary. See the
deferred optimisation in [projection.md](projection.md) for the canonical
"tempting, but it closes possibility space — wait" case, and the anchor-boundary
warning there for why incremental recompute in particular is *not* a freebie.

## Build & tooling

The shippable web root is the repo-root **`static/`** (gitignored, regenerated),
assembled by overlaying three stages — `skeleton/` (hand-authored shell) → ETL
bake (`json/` + `img/`) → this build (`index.html` + `js/`). The root `Makefile`
orchestrates the full pipeline (`make` / `make deploy`); the npm scripts here are
the build stage it drives:

- `npm run dev` — esbuild dev server serving the combined web root from
  `../static`, with live rebuild. (Run `make seed bake` first so the data is
  there to serve.)
- `npm run build` — minified bundle into `../static/js/app.js` (+ `index.html`).
- `npm run deploy` — `wrangler pages deploy ../static` (Cloudflare Pages).
- `npm run gen:types` — compile the ETL's `config/schema/` into `core/bundle/`.
- `npm run check` — `tsc --noEmit`, the build-time type check (above).
- `npm test` — `node --test` over `js/src/core/**/*.test.ts` (see Testing).

Source lives here in `src/` (and `index.html` / `css/`); build output deploys
into the shared `static/` root alongside the ETL's `json/` + `img/`. **Never
hand-edit anything in `static/`** — it's all regenerated, by the skeleton seed,
the ETL, or this build.

## See also

- [trust-and-failure.md](trust-and-failure.md) — the trust boundaries and failure
  tiers these conventions assume.
- [architecture.md](architecture.md) — why the layering and the driver are shaped
  this way.
