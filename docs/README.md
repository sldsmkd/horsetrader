# Horsetrader — Documentation

Single source of truth for the whole horsetrader project: the **ETL** (Python
pipeline) and the **site** (web planner), plus the contract between them. If
something here contradicts a stale comment, an old branch, or an LLM's memory,
**this folder wins**.

The project is two code repos side by side under one tree — `horsetrader/` (the
ETL, this repo's root) and `horsetrader.site/` (the planner, its own repo). Their
docs are consolidated here so the shared contract has one home.

## Layout

| Folder | Covers |
| --- | --- |
| [`etl/`](etl/) | the Python pipeline: scrape → normalise → predict → bake |
| [`frontend/`](frontend/) | the raw-DOM TypeScript planner that consumes the bake |
| [`references/`](references/) | catch-all junk drawer — scraps, announcements, old research/predictions. Not pipeline input, not authoritative. |
| (this level) | crosscutting docs both sides depend on |

## Crosscutting — read these whichever side you're on

| Doc | What |
| --- | --- |
| [contract.md](contract.md) | the ETL↔site interface: the baked bundle, its schema, the trust boundary, the stable-key vocabulary, what crosses the wire |
| [domain.md](domain.md) | game-side concepts (resets, scenarios, Champions Meetings, banners) the timeline models |

## By side

- **ETL** — start at [etl/README.md](etl/README.md): setup, pipeline stages, data
  sources, prediction, code standards, the character-module naming convention.
- **Site** — start at [frontend/README.md](frontend/README.md): design-ahead-of-code
  — the two `core/` pillars (persistence, projection), trust & failure.

## Keeping docs honest

When something falls out of date, **fix or delete the section** rather than
papering over it with a "see also". Stale docs are worse than no docs. Sniff test:
if a reader followed this verbatim, would they end up in the current code (or
agreed design), or in last quarter's?

The top-level [`AGENTS.md`](../AGENTS.md) is a thin pointer here for agentic tools.
