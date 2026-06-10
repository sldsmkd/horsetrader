# Horsetrader Site — Documentation

This folder is the single source of truth for how the horsetrader **site** (the
web planner) is designed and the conventions it expects. If something here
contradicts a stale comment, an old branch, or an LLM's memory, **this folder
wins**.

Scope: the site — the raw-DOM TypeScript planner that consumes the static JSON +
image bundle baked by the **etl**. The site lives at `horsetrader.site/` as a
tracked subtree of the monorepo; its docs live alongside the ETL's under one tree:
the ETL is in [`../etl/`](../etl/) and the shared interface in
[`../contract.md`](../contract.md). Editing ETL *code* from a site session is
still a boundary crossing — but the docs are shared.

## Status: `core/` built, `ui/` is captured intent next to code

As of **2026-06-02** the keystone is laid — both `core/` pillars exist under
`horsetrader.site/js/src/core/` and are headless-tested (`npm test`):

- **Persistence** (pillar 1) — the four-section document, storage module, and
  validation/recovery. See [persistence.md](persistence.md).
- **Projection** (pillar 2) — the pure fold, the rich ledger + its folds, the
  dense balance-series scrub cache, and three ground-truth channels (events,
  generator, sequence). See [projection.md](projection.md).
- **The coordinator** — the headless seam joining the two: it loads the plan,
  builds channels from the bundle, folds the enabled ones, and recomputes on any
  change. The UI will be a pure consumer of this seam.

A small supporting seam is **planned** (not a pillar):

- **Entity query broker** — a thin `core/` query layer over the bundle so
  components ask for intent (search, label, image, events featuring a card)
  instead of reaching into raw records. Mostly a consolidation of lookups that
  already live in `ui/search` and `ui/oshi`. See [catalog.md](catalog.md);
  tracked as **#35**.

Two slices of projection are **still to come** (now unblocked — see below):
the **spends/commitments** channel (the one stream that consumes the fold's own
output for affordability) and the **expected-copies distribution**.
**Rushed-event posting** is now **built** (the `events` channel posts a rushed
event's discrete rewards at `start`). [projection.md](projection.md) has the
ordered next-steps.

The **view layer** is fully captured intent-first, surface by surface, in
[ui.md](ui.md) — **every surface is documented** as of 2026-06-02, but `ui/`
*code* is not yet written. That doc is the settled design the view layer will
follow.

### ETL cross-side blockers: resolved / tracked

The sequence value type that projection's daily-login channel needs **shipped**
from the ETL (`SequenceReward`), so the spends/commitments work is now a pure
frontend task. The remaining cross-side asks — **procedural stream rates** and
**baked drop rates** — are tracked on the live tracker (GitHub issues / board on
`sldsmkd/horsetrader`); the
contract is settled in [`../contract.md`](../contract.md).

## Start here

| If you want to… | Read |
| --- | --- |
| Understand the whole design in one pass | [architecture.md](architecture.md) |
| Know what we store and why so little | [persistence.md](persistence.md) |
| Understand the engine that derives everything | [projection.md](projection.md) |
| Understand the entity query broker (search/label seam over the bundle) | [catalog.md](catalog.md) |
| Understand how the site presents itself (the view layer) | [ui.md](ui.md) |
| Understand the menubar, Identity, Resources, and Tazuna | [menu.md](menu.md) |
| Track Identity Play Style preset UX and semantics | [identity-presets.md](identity-presets.md) |
| Know how the interactive `ui/` layer is wired (implementation) | [interaction.md](interaction.md) |
| Wire a customisation flow into the live projection (the "final glue" epic) | [glue.md](glue.md) |
| Know the language, layering, and DOM patterns | [conventions.md](conventions.md) |
| Know what we trust, validate, and how we fail | [trust-and-failure.md](trust-and-failure.md) |

## The one-paragraph version

The ETL does all the heavy lifting and bakes a static bundle; the site is hosted
as static files on a CDN and **all runtime compute happens on the user's device**
— no server, no bill. The site has two core pillars. **Persistence** stores a
*minimal set of user inputs* (a dated resource snapshot, configuration,
per-banner commitments, favourites). **Projection** folds those inputs plus the
baked bundle into a **ledger** — a list of attributed, dated, signed
resource deltas — from which every visible surface (the timeline, the per-day
tooltip, the cursor balance, the whole-timeline scrubber) is derived as a view.
The planner *informs, it never enforces*: balances are allowed to go negative
because the dip is the information.

## Keeping docs honest

When something here falls out of date, **fix or delete the section** rather than
papering over it. Stale docs are worse than no docs. Sniff test: if a reader
followed this verbatim, would they end up in the current code (or the agreed
design), or in a discarded one?
