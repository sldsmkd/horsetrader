# Horsetrader ETL — Documentation

How the horsetrader ETL works, how to run it, and the conventions it expects new
code to follow. Scope: the Python pipeline that scrapes Gametora / Umapyoi,
normalises the data, predicts EN dates, and bakes the JSON + image bundle the web
planner consumes. The planner itself is documented in
[`../frontend/`](../frontend/); the interface between them is
[`../contract.md`](../contract.md).

## Start here

| If you want to… | Read |
| --- | --- |
| Get the pipeline running on a new machine | [onboarding.md](onboarding.md) |
| Understand what runs in what order | [architecture.md](architecture.md) |
| Add a new extractor / event type end-to-end | [howto-new-extractor.md](howto-new-extractor.md) |
| Decode the character module names (`@digitan`, `@shakur`, …) | [semantics.md](semantics.md) → in-repo [overview](../../horsetrader/semantics/overview.md) |
| Know the code conventions before opening a PR | [standards.md](standards.md) |
| See what's scraped vs. hand-curated | [data-sources.md](data-sources.md) |
| Understand how unscheduled EN dates get predicted | [prediction.md](prediction.md) |
| Read up on game-side concepts the ETL depends on | [../domain.md](../domain.md) |
| Know exactly what the ETL must hand the planner | [../contract.md](../contract.md) |

## What's *not* here

- **Site / planner / UI** docs — see [`../frontend/`](../frontend/).
- **Per-character lore** — the `.md` files alongside each decorator in
  [`../../horsetrader/semantics/`](../../horsetrader/semantics/).
- **API reference for individual classes** — docstrings are the source of truth
  for class- and method-level behaviour. These docs cover *concepts* and
  *conventions*, not signatures.

## Keeping docs honest

When something falls out of date, **fix or delete the section** rather than
papering over it. Stale docs are worse than no docs.
