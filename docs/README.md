# Horsetrader — Documentation

Single source of truth for the whole horsetrader project: the **ETL** (Python
pipeline) and the **site** (web planner), plus the contract between them. If
something here contradicts a stale comment, an old branch, or an LLM's memory,
**this folder wins**.

The project is one monorepo: `horsetrader/` (the ETL, Python, at the repo root),
`horsetrader.site/` (the planner, TypeScript), and `horsetrader.cloud/` (the small
Unity sync service). Their docs are consolidated here so the shared contract has
one home.

## Layout

| Folder | Covers |
| --- | --- |
| [`etl/`](etl/) | the Python pipeline: scrape → normalise → predict → bake |
| [`frontend/`](frontend/) | the raw-DOM TypeScript planner that consumes the bake |
| [`design/`](design/) | agreed crosscutting design notes that are not specific to only ETL or frontend |
| [`projects/`](projects/) | the named arcs (Trackblazer, Debut, Grand Masters, Twinkle Monthly, …) — project records: thesis, decisions, what shipped, what was deliberately not done |
| [`database/`](database/) | official client database catalog and evidence-backed semantic maps |
| [`trainernet/`](trainernet/) | numbered QA runbooks that thread operational discoveries through the full product |
| [`ideas/`](ideas/) | exploration backlog — uncommitted design ideas, not yet code or agreed design |
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
- **Site** — start at [frontend/README.md](frontend/README.md): the two `core/`
  pillars (persistence, projection), the view layer, the glass/world contracts,
  trust & failure.
- **History** — [projects/README.md](projects/README.md) lists every named arc and
  which living doc it graduated into. Living docs beat arc docs.

## Keeping docs honest

When something falls out of date, **fix or delete the section** rather than
papering over it with a "see also". Stale docs are worse than no docs. Sniff test:
if a reader followed this verbatim, would they end up in the current code (or
agreed design), or in last quarter's?

The top-level [`AGENTS.md`](../AGENTS.md) is a thin pointer here for agentic tools.
