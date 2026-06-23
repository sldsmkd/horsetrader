# The Cover (phase 3)

> The last Twinkle Monthly phase. The Interview (notes) and The Filing (the film
> strip) shipped; this is the readable plan surface they were always pointing at.

The Cover splits cleanly in two, and the split is the design:

1. **The Desk** — the *production* surface. The player's editorial desk where the
   whole plan is laid out legibly and worked on. Full utility, live, private,
   mutable. *Gathering the headlines and typesetting the cover.*
2. **To Press** — the *publication* step. A distinct, deliberate act that freezes
   the typeset desk into a shareable artifact. Separate from the Desk on purpose:
   the desk is mutable and private; going to press is a snapshot.

**To Press is parked.** Its artifact form (image / encoded link / Canter) is a
*figure-it-out-later* call — see [[project_shareable_plan_artifact]]. We build the
Desk first; a clean readable Desk is already most of a shareable artifact, so Press
should largely fall out of it rather than be its own build. This doc is about the
Desk.

Not a magazine skin. Stays in the glass-table language throughout (see
[[project_debut_design_language]]) like every other surface.

---

## The Desk — what it is

A surface of **horizontal rows, one per committed banner** — a table. It is the
**film strip's data, filtered to commitments, and turned on its side**: where the
strip compresses every favourite + commitment into equidistant squares along one
axis, the Desk takes only the *committed* banners (the plan) and gives each its own
full-width row with room to read.

| | Film strip (The Filing) | The Desk (The Cover) |
|---|---|---|
| Population | favourites **and** commitments, all time | **commitments only** (the plan) |
| Unit | the favourited atom (a banner can be 2 frames) | the **banner** (one row per commitment) |
| Axis | ordinal sequence, view-following read-head | a **table** — rows stacked, scannable |
| Density | a glance / nav | the **legible whole** — type, window, cost, pity, pulls, note |

Same underlying facts, different question. The strip answers *"in what order, at a
glance"*; the Desk answers *"what is my whole plan, in full, readably"* — the job a
planning spreadsheet did, but legible.

The exact table shape — which columns, what's in a row, how a row expands — is
**discovery work**. We expect to grow systems to drive it (this is the first phase
that's explicitly open-ended rather than spec-then-build). The starting shape below
is a floor to react to, not a frozen contract.

---

## The spine already exists (reuse, don't re-derive)

The Desk does not need new projection. Every fact a row wants is already computed
and cached for the strip and the timeline badge:

- **The committed set + funding fact** — `coordinator.commitmentStatuses()` returns
  `Map<bannerKey, CommitmentStatus>` (`core/projection/pulls.ts`): `kind`, `pity`,
  `unfundable`, leftover `capacity`. Derived **once per write** in `derive()`; the
  strip, plan badge and dossier all read it so they cannot disagree. The Desk reads
  the same map — its rows *are* this map's entries. This is the filter ("banners
  with commitments") and the affordability column in one.
- **The band colour** — `pityBand(status)` (`ui/views/widgets/pityBand.ts`):
  grey/green/purple/red (none/sensible/waste/unfundable). Same rule the strip
  capsule and the badge use → the Desk agrees with them by construction.
- **Banner identity + window + contents** — off the bundle event
  (`type`, `start`, `end`, `contents`, `rewards.pulls`) via the existing
  `aboveLane` helpers (`atomOf`, `atomImage`, `bannerHeatBand`).
- **The featured content + favourite/inspect** — the **`atomChip`** widget already
  renders a banner's contents as portrait pills that favourite + open the card
  surface. A row's content cell is a strip of `atomChip`s; the card surface (notes
  home) is one click away, exactly as on the banner card.
- **The note** — the banner's note from the notes layer (The Interview), inline on
  the row. Atom notes already live on the card surface the chips open to; the
  **banner** note is the one that belongs on the row itself (the README always put
  the banner note on "the banner/plan side" — the Desk *is* that side).

So a row is a *view* assembled from cached facts, CSS-free selector in `ui/select/`
(house convention: testable view-model split out of the `.css`-importing surface,
as `filmstrip.ts`/`filmstrip` and `cardDetail.ts`/`cardSurface` already are).

---

## The row shape is discovery work — its own doc

The exact table — what's in a row, how rows group/order, what aggregates the plan
grows — is the **most complex and most UI-rich** problem on the site, and it's
largely **information architecture** before it's UI. It gets its own living,
deliberately-messy working doc: **`desk-discovery.md`**. The starting row (kind/window
· content chips · pity + band · banner note) is a floor to react to there, not a
contract here.

---

## Where it lives

A spawnable surface (modal-to-canvas like the other shields), not docked chrome —
the strip is the always-on glance; the Desk is the thing you *open* to work the
whole plan. Spawn off the menubar alongside the other surfaces. (Exact placement is
a small later call; it doesn't change the model.)

---

## Method

Discovery-driven, not spec-then-build. Branch `twinkle-monthly` (re-cut from main;
The Filing is merged). Build the rows off the cached `commitmentStatuses()` map,
react to the live surface, grow the table by what it turns out to need. To Press
comes after the Desk is real and is its own (deferred) design pass.
