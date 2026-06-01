# Horsetrader Site — Documentation

This folder is the single source of truth for how the horsetrader **site** (the
web planner) is designed and the conventions it expects. If something here
contradicts a stale comment, an old branch, or an LLM's memory, **this folder
wins**.

Scope: the site — the raw-DOM TypeScript planner that consumes the static JSON +
image bundle baked by the **etl**. The site is its own repo (`horsetrader.site/`),
but its docs now live alongside the ETL's under one tree: the ETL is in
[`../etl/`](../etl/) and the shared interface in [`../contract.md`](../contract.md).
Editing ETL *code* from a site session is still a boundary crossing — but the docs
are shared.

## ⚠️ Status: design ahead of code

Unlike the ETL docs (which describe code that exists), **these are design docs
written before the foundation is built.** As of 2026-05-31 the site is a thin
scaffold — an esbuild + (soon) TypeScript toolchain and a smoke-test entry that
just proves the data bundle loads. The two pillars described here (`core/`
persistence and projection) are **not yet implemented**. Read these as the
design the code *will* follow, not as a map of current `src/`.

The UX / widgets are deliberately deferred. This foundation is the keystone; the
UI sits on top of it once it's laid.

## Start here

| If you want to… | Read |
| --- | --- |
| Understand the whole design in one pass | [architecture.md](architecture.md) |
| Know what we store and why so little | [persistence.md](persistence.md) |
| Understand the engine that derives everything | [projection.md](projection.md) |
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
