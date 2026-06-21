# Twinkle Monthly · Step 1 — The Card Surface (shell + commit-dossier hook)

> **✅ COMPLETE (2026-06-21, branch `twinkle-monthly`).** All four deliverables
> shipped, `tsc` + 250 FE tests green, verified live (Gold Ship's summer card
> renders art + identity + bio + the coloured aptitude ladder + the `full stats`
> deep-link). Uncommitted in the working tree. Deviations from this brief, all
> deliberate:
>
> - **Canonical URL: Transcend reports it, the model does not sniff `References`.**
>   The spec said the model picks the canonical URL out of the mixed `References`
>   list. Building it proved that fragile — trainee art is served off the bare
>   `gametora.com/images/...` host with a *deeper* path than the entity page, so
>   every "deepest gametora URL" heuristic grabbed the image. Instead the Gametora
>   scraper (`@transcend`) constructs the canonical **English** entity page
>   deterministically from the slug (`/ja/` = Japanese; EN = the locale-less
>   mirror) and reports it as a named `source` field threaded scraper → index →
>   model → mapper → record. The entity model stays source-agnostic.
> - **View-model split out of the surface.** The kind-branch lives in a pure,
>   CSS-free `ui/select/cardDetail.ts` (`cardDetails(bundle, kind, id)`), tested
>   directly; `cardSurface.ts` only renders. Reason: the surface's `.css`
>   side-effect import can't load under node's test runner, so testable logic must
>   stay in `select/` (house convention). The "renders for a trainee/support id"
>   tests therefore assert the view-model, not the DOM (no jsdom in this project).
> - **Bonus ETL enrichment landed in the same arc** (the "ETL enrichment comes in
>   later steps" line, pulled forward): trainee **base aptitudes** (`AptitudeRank`
>   enum → `AptitudesRecord`, rendered as a coloured ladder via the
>   `--ht-colour-aptitude-*` palette tokens) and character **bio** vitals
>   (birthday / height / three sizes, nullable members for pals/NPCs/scrape-lag).
>   Both are data-gathering passes; richer interactions still deferred.
> - **Modality:** `cardDetail` was folded into `modalOpen()` so the surface is a
>   first-class modal (menubar lock + second-spawn refusal), not just a stacked
>   child. The commit-draft-reset rough edge below is left as-is, as planned.

The first buildable slice. Ship the **vessel**: a spawnable trainee/support
detail surface, minimal, hooked from one real place. Notes, plan-context, and
ETL enrichment come in later steps — see [README.md](README.md). This doc is the
implementation brief; read the README for the *why*.

## Goal

Clicking a featured card in the commit dossier opens a **card detail surface**
showing that atom's art + identity facets + an outbound "full stats" link. That's
it. It proves the surface in a live place and gives the note layer a home to be
born into later.

## Non-goals (explicitly out of this step)

- **Notes** — no editor, no notes map, no validation clearing house.
- **Plan context** — favourited?/committed-where/appearances are *not* on the
  surface yet (later step).
- **The favourites/plan split** (The Filing), **sharing/Canter**, the effect/
  hint tables (we never reproduce those — link out).
- Spawning from anywhere *other* than the commit dossier (search/bookmark hooks
  come when those surfaces are touched).

## Decisions taken

- **One surface, kind-branched.** A single `cardSurface({ kind, id })` that
  branches trainee vs support internally — mirrors how `commitDossier` handles
  both via `ctx.kind`. Not two surfaces.
- **Modal, centred placement.** Like the commit/balance modals: `placement:
  "center"`, `headerless: true`, transparent to the canvas, suspends siblings.
- **The link renders only when present.** The source URL is the *one* optional
  field — some entities may lack a Gametora ref. Show the link if the baked field
  is non-null; otherwise omit it. (This is not a `resolve-or-throw` case — the
  *record* resolves or throws; the link is a may-be-absent attribute.)

## The substrate (what exists)

- **Surface spawn pattern** — `ui/app.ts` render reads `view.get()` and pushes
  `surface({ placement, headerless, body, onClose })` into `children`;
  `placement: "center"` ⇒ `surface--modal` ⇒ suspends siblings + locks menubar.
  `committing: string | null` (a banner key) is the closest prior art — see
  `ui/app.ts` ~639–666.
- **viewState** — `ui/state/viewState.ts`, `interface ViewState` with simple
  nullable keys (`committing`, `right`, `cloudConnecting`).
- **The hook point** — `commitDossier.ts` `featuredCard(atom)` renders each
  featured `CommitAtom`. `CommitAtom extends BannerAtom`, so it already carries
  `id`; `kind` is `ctx.kind`. Currently the card is a non-interactive `<li>`.
- **Bundle access** — `bundle.trainee(id)` / `bundle.support(id)` return
  `TraineeRecord` / `SupportRecord` (resolve-or-throw via `must`). Fields below.
- **`BannerKind`** = `"trainee" | "support"` (from `ui/select/aboveLane.ts`).

### Facets available to render (no new FE data needed)

`SupportRecord`: `character`, `display`, `type`, `rarity`, `title`, `release`,
`thumbnail`, `art`, `aliases`.
`TraineeRecord`: `character`, `variant`, `title`, `rarity` (number), `release`,
`thumbnail`, `portrait`, `aliases`.
Name resolves through `bundle.character(...)` when `display`/character is needed
(same logic as `select/bookmarks.ts rowFor`). **Art hero**: support →
`art ?? thumbnail`; trainee → `portrait ?? thumbnail`.

## Deliverables

### 1. ETL — bake the canonical source URL  *(cross-cutting; the link's data)*

Every record carries a `References` provenance list
(`horsetrader/models/core/references.py`) already holding its Gametora entity
URL. Project it onto the academy record:

- The **model** owns selecting the canonical URL out of the mixed `References`
  list (URLs + cache Paths) — add it to `References` (or the entity), e.g. a
  `canonical()`/source property. That is the model's job, not the bake's; the
  bake must do **no host-sniffing**.
- Add an optional `source: string | null` field to the support + trainee academy
  records; bake projects the model's canonical URL onto it.
- `make gen:types` to regenerate `academy.gen.ts`; the FE field appears as
  `string | null`.

> The FE surface can land before this and simply omit the link; the link lights
> up once the field is baked. Keep them decoupled so neither blocks the other.

### 2. FE — `cardSurface`

New `ui/views/surfaces/cardSurface.ts` (+ `.css`), following the glass-table
language (self-rendered title, no window chrome, art-forward). Signature:

```ts
export interface CardSurfaceOpts { bundle: Bundle; kind: BannerKind; id: string; onClose: () => void; }
export function cardSurface(opts: CardSurfaceOpts): HTMLElement
```

Renders: **art hero**, name + rarity, the kind-appropriate facets (support: type
pip + title; trainee: variant + title), release date, and — when
`record.source` is non-null — an outbound `full stats ↗` anchor
(`target="_blank" rel="noopener noreferrer"`). Pure view; resolve the record
through the bundle (throws on a bad id, per house style).

### 3. FE — spawn wiring

- Add to `ViewState`: `cardDetail: { kind: BannerKind; id: string } | null`
  (default `null` in the store). One typed key, like `committing`.
- In `ui/app.ts` render, after the commit modal block: when `cardDetail !==
  null`, push a centred modal whose body is `cardSurface({ bundle, ...cardDetail,
  onClose })`; `onClose` clears `cardDetail`.

### 4. FE — the hook

- `commitDossier`: add an `onInspect(atom: CommitAtom)` opt; make `featuredCard`
  a `<button>` (or add a click handler) that calls it.
- `app.ts`: pass `onInspect: (atom) => view.set({ cardDetail: { kind: ctx.kind,
  id: atom.id } })` into the `commitDossier({...})` call.

## Known rough edge — modal over modal

The commit dossier holds its **draft pity in a closure**, and `app.ts` rebuilds
`children` on every `view.set`. So opening the card detail from inside it
re-renders the commit dossier from scratch → **an unsaved pity draft resets to
the stored commitment.** For Step 1 this is acceptable (the card surface is a
read-only peek; nothing is lost but an in-progress, unsaved number). Do **not**
solve it by lifting commit draft into viewState now — note it and move on. The
clean fix (when notes make the round-trip matter) is a later step.

## Tests

- `cardSurface` renders for a trainee id and a support id (art src, name, rarity,
  facets present).
- Link anchor present iff `record.source` is non-null; absent otherwise.
- Bad id throws (resolve-or-throw).
- Spawn: setting `cardDetail` mounts a `surface--modal`; `onClose` clears it.
- (ETL) the canonical-URL selection on the model picks the Gametora URL out of a
  mixed `References` list and ignores cache Paths.

## Done when

A featured card in the commit dossier opens an art-forward detail surface for
that trainee/support, with a working outbound stats link where data exists, and
closes back cleanly. `tsc` + tests green.
