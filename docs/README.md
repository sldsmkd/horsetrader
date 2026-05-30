# Horsetrader ETL — Documentation

This folder is the single source of truth for how the horsetrader ETL works,
how to run it, and the conventions it expects new code to follow. If something
here contradicts a stale comment, an old branch, or an LLM's memory, **this
folder wins**.

Scope: the ETL repo only — the Python pipeline that scrapes Gametora /
Umapyoi, normalises the data, predicts EN dates, and writes the JSON bundle
the web planner consumes. The web (JS) side lives in a separate repo and is
not documented here.

## Start here

| If you want to… | Read |
| --- | --- |
| Get the pipeline running on a new machine | [onboarding.md](onboarding.md) |
| Understand what runs in what order | [architecture.md](architecture.md) |
| Add a new extractor / event type end-to-end | [howto-new-extractor.md](howto-new-extractor.md) |
| Decode the character module names (`@digitan`, `@shakur`, …) | [semantics.md](semantics.md) → in-repo [overview](../horsetrader/semantics/overview.md) |
| Know the code conventions before opening a PR | [standards.md](standards.md) |
| See what's scraped vs. what's hand-curated | [data-sources.md](data-sources.md) |
| Understand how unscheduled EN dates get predicted | [prediction.md](prediction.md) |
| Read up on game-side concepts the ETL depends on | [domain.md](domain.md) |

The top-level [`AGENTS.md`](../AGENTS.md) is a thin pointer to this folder for
agentic tools (Claude Code, Codex, etc.). It is intentionally short — content
lives here.

## What's *not* here

- **Site / planner / UI** docs — the JS planner moved to its own repo.
- **Per-character lore** — see the `.md` files alongside each decorator in
  [`horsetrader/semantics/`](../horsetrader/semantics/).
- **API reference for individual classes** — docstrings are the source of
  truth for class- and method-level behaviour. These docs cover *concepts*
  and *conventions*, not signatures.

## Keeping docs honest

When something in these docs falls out of date, **delete or fix the section**
rather than papering over it with a "see also" note. Stale docs are worse
than no docs. A useful sniff test: if a reader followed this verbatim, would
they end up in the current code or in last quarter's design?
