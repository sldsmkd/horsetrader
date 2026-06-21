# Twinkle Monthly · Phase 1 — The Interview (the notes layer)

> **✅ COMPLETE (2026-06-21, branch `twinkle-monthly`, uncommitted).** Notes added,
> validated, displayed on the trainee + support card surfaces. `tsc` + 252 tests
> green. As built:
> - **Schema** — `Notes = { [subjectId]: string }` (flat, stable-id-keyed) on the
>   synced `PlanDocument`; `CURRENT_VERSION 2 → 3`; `FavouriteEntry` is now bare
>   (`Record<string, never>`), its old `note` folded into the notes map by the
>   v2→v3 migration (a note no longer implies a star).
> - **Validation** — one `normaliseNote` (trim, tweet-cap by code point, strip C0
>   controls except newline) in `core/persistence/validate.ts`, used at *both* the
>   live write seam (`coordinator.setNote`) and the persistence ingress
>   (`validateNotes`), so a typed note and a hand-edited save get identical rules.
>   Display is escaped by construction (`h` appends text nodes).
> - **UI** — a `noteBox` textarea on `cardSurface.ts`, commits on blur via
>   `onSetNote` → `coordinator.setNote`; `app.ts` reads/writes the note keyed by the
>   card's stable id. Styling is intentionally minimal (a glass-table polish pass
>   is parked with the card's).
> - Notes count as syncable content (`planHasContent`) and pass the egress gate.
>
> The README's later phases (The Filing, The Cover) remain untouched and out of
> scope, as below.

The first half of the thesis: a plan can hold the trainer's *voice*, not just the
numbers. This phase adds **notes** — the orthogonal "why" layer (see
[README.md](README.md)) — born into the card surface that
[step-1-card-surface.md](step-1-card-surface.md) already shipped as the vessel.

**One cohesive deliverable, not sub-phases:** add a note, validate it on the way
in, display it — on the trainee + support card surfaces. Validation is part of
accepting a note, not a separate clearing-house build.

## In scope

- **Schema** — a subject-keyed notes map in the synced player save, + migration.
- **A note box on the trainee + support card surfaces** — write / edit / clear,
  glass-table (hover-to-edit, no pencils).
- **Validation on input** — trim, a tweet-length cap (~280, a publishable unit not
  a storage ration), control-char policy, and escape-on-render (a note is user
  data, **never** markup). A small inline normaliser co-located with the notes
  seam — *not* a generalised input-validation service.
- **Display** — the note renders (escaped) on the card.

## Out of scope (explicitly)

- **The Filing** (README phase 2) — breaking favourites and the plan apart. Notes
  do *not* depend on that split; they ride the existing maps' sibling seam.
- **The Cover** (README phase 3) — the readable plan surface.
- **Banner notes** — only *atom* notes (trainee/support) land here; banner notes
  live on the banner/plan side, which is Filing-era.
- **Canter / sharing**, and any normalising of *other* inputs (name, club, the
  balance sheet) or hardening the untyped `config` bag. Those are separate later
  passes, not this one.

## The model

Notes are durable intent that should follow the player across devices → they live
in the synced `remote` `PlanDocument` (`core/persistence/document.ts`), alongside
favourites/commitments — **not** device-local.

- **Key: flat `{ [subjectId: string]: Note }`.** `subjectId` is the ETL stable id,
  already globally unique *and* prefix-typed (`trainee-…` / `support-…`), so one
  map holds every atom note and the prefix recovers the kind. (Resolves the
  README's "flat vs tagged `{kind,id}`" open question → flat.)
- **Value: a trimmed string** — the most naive thing that works. Sparse like
  `FavouriteEntry`: absent key ⇒ no note; clearing the text deletes the key, never
  an empty string. (If a later phase needs per-note metadata it grows to an
  object then — cheap migration, not worth pre-paying now.)
- **Version bump + migration.** Fold the unused, wrongly-coupled
  `FavouriteEntry.note` into the notes map (keyed by the same entity id) and drop
  it; bump `CURRENT_VERSION`.

## The box (FE)

A hover-to-edit text affordance on `cardSurface.ts` (trainee + support). Glass-table
language: reads as text until interacted, inline edit, no pencils; honour the
in-timeline two-opt-in pointer pattern if it sits on the canvas
([[project_in_timeline_controls_pattern]]). Pure view — the surface gets the
current note + an `onSetNote(text)` callback; `app.ts` wires those to the
coordinator (read the note, write it back), same shape as the favourite/commitment
seams. Commit on blur/enter through the inline normaliser.

## Done when

A trainer can type "won't leave the gate till she feels like it" on Gold Ship's
card, it persists across reload and sync, renders escaped, and clears cleanly —
with input trimmed and capped on the way in. `tsc` + tests green.
