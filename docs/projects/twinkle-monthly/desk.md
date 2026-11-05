# The Desk — the plan surface (Twinkle Monthly phase 3)

Status: **shell built (`ui/views/surfaces/planSurface.ts`); row shape and
plan-level rollups are open discovery.** Living, deliberately messy working doc —
append to the running log as the surface teaches us things.

The Cover is phase 3 of [Twinkle Monthly](README.md), split in two on purpose:

1. **The Desk** — the *production* surface. The whole plan laid out legibly and
   worked on: live, private, mutable.
2. **To Press** — the *publication* step that freezes the Desk into a shareable
   artifact. **Parked**; its form (image / encoded link / Canter) is a later call.
   A clean readable Desk is already most of a shareable artifact.

Not a magazine skin — glass-table language throughout.

## What it is

A table of **one row per committed banner**: the film strip's data, filtered to
commitments and turned on its side.

| | Film strip (The Filing) | The Desk (The Cover) |
|---|---|---|
| Population | favourites **and** commitments | **commitments only** |
| Unit | the favourited atom | the **banner** |
| Axis | ordinal, view-following read-head | a table, rows stacked |
| Density | a glance / nav | the legible whole — window, pity, band, forecast, note |

A centred modal spawned from the menubar's Plan (tablet) button, which only
appears once a commitment exists. On phones it is a full-viewport takeover (see
[glass.md](../../frontend/glass.md)).

## The spine already exists — reuse, don't re-derive

The Desk needs no new projection:

- **Committed set + funding** — `coordinator.commitmentStatuses()`
  (`core/projection/pulls.ts`): `kind`, `pity`, `unfundable`, leftover `capacity`,
  derived once per write. Strip, badge, dossier and Desk all read it.
- **Band colour** — `pityBand(status)` (`ui/views/widgets/pityBand.ts`):
  grey/green/purple/red = none/sensible/waste/unfundable.
- **Banner identity, window, contents** — off the bundle event via the `aboveLane`
  helpers.
- **Content** — `atomChip`s, which favourite and open the card surface.
- **The note** — the *banner* note lives on the row. Atom notes stay on the card
  surface the chips open.

Row view-models are a CSS-free selector in `ui/select/plan.ts` (house convention).

## Settled boundaries — don't relitigate

- **Writer vs viewer.** The commit dossier is the pity writer. The row's commit
  badge is the dossier's door (one `view.set` swaps Desk → dossier); the Desk
  never forks the write path.
- **Notes are a staged edit.** Row notes live in their textareas until an explicit
  **Update** (dismiss reads "Close" until the first edit, then "Cancel"/"Update").
  No commit-on-blur — a blur → write → refresh mid-gesture tore down the element
  being edited.
- **Agrees with the strip and badge by construction.** A row disagreeing with the
  strip capsule is a bug.

## Current row (2026-06-23, left → right)

- **Commit cell** — the shared `commitmentBadge` (band fill, ring, pity) with the
  start date stacked beneath (`Jul 2` over `2026`).
- **Content chips** — compact icon-only `atomChip`s, sorted `favourited DESC,
  rarity, name`, capped at `MAX_CHIPS = 4` in a fixed column so rows align.
- **Banner note** — the flexible middle column.
- **Compact forecast** — right edge.

Kind (trainee/support) is the row's left-border colour, not a pill. The Desk is
about double the standard modal width so the note column has room.

## Open IA questions

Roughly in order of how much they shape everything else:

1. **The spine** — what does a reader scan down? Hypothesis: **time**, with band as
   a *signal* not a sort. Alternatives: band (triage — problems first), kind
   (weak), oshi/character (emotionally true; a banner has several contents).
2. **Flat or grouped?** Month / kind / "settled vs at risk" groupings add
   headers and subtotals — power, but weight.
3. **Primary vs secondary in a row** — band is the alarm, the note the meaning,
   numbers the reference. Which is the headline?
4. **Progressive disclosure** — what earns always-on space vs expand/hover.
5. **The whole-plan gestalt** — what the surface says in one second before you
   read a row (a total? a health colour? "you can afford this"?). Probably the
   Desk's reason to exist.
6. **Units** — carats vs pulls vs pity-bags for the *plan* read.
7. **Note display length** — storage cap is 140 code points; whether the row
   truncates-with-expand is a question for ~4 real users, not the armchair.

**Plan-level rollups don't exist yet** (total spend, per-month totals, whole-plan
affordability against the projected balance, counts by kind/band). Discovering
which ones matter is the core work.

## Forward: shaping the forecast with limit breakers

The per-row forecast is the seam a later feature plugs into: committing limit
breakers to *shape* the predicted outcome, feeding the same `bannerForecast` the
dossier and Desk share. **Kind asymmetry is load-bearing:** rainbow crystals /
shards are a valid resource for **support** banners only (trainees star up off
character pieces), so the lever belongs on the support path and at the shaping
input, not the readout.

## Running log

- **2026-06-23 — first live row** iterated against the dev server (shape above).
- **2026-06-23 — the prior-art corpus.** The user's real planning spreadsheet
  confirmed the design: notes are **two-clause, directive + contingency** ("pull
  400 if maru 2LB+ / 200 otherwise and wait for rerun"); they constantly cite pity
  and affordability, which the Desk now co-locates; there are exactly **two note
  kinds** (character flavour → atom note; per-banner directive → Desk note); all
  notes were well under 140 characters. The spreadsheet's red/green/yellow row
  backgrounds suggest a *conviction* axis — parked, it would collide with kind and
  band colours.
- **Staged-editor rework** — Desk and card detail became staged editors (see
  settled boundaries). Suspected to be behind an intermittent "app locking";
  tracked in the root `TODO.md`.
