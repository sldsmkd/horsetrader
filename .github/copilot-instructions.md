# Copilot instructions — horsetrader

You're the **weekend shift** on this repo. Before doing anything, read the
handoff note: **[`docs/handoff/2026-06-04-weekend.md`](../docs/handoff/2026-06-04-weekend.md)**.
It has your onboarding, the rules, and a tiered task list.

## The non-negotiables (full detail in the handoff)

1. **Docs are the source of truth** — start at [`docs/README.md`](../docs/README.md);
   if code contradicts the docs, the docs win, and fix the doc rather than working
   around it.
2. **One side per session** — this is a monorepo: **ETL** (Python, repo root) and
   **site** (TypeScript, `horsetrader.site/`). They share a contract, not a session.
   If a task pulls you across the backend↔frontend line, **stop and leave a note**.
3. **JP is the substrate, EN is projected** — on the ETL side, build from the JP
   scrape, never from the EN YAML.
4. **Trust the bake** — frontend bundle lookups resolve or throw; never guard with
   `undefined`. (The ETL's *scraped*-input path is the one place that warn-and-skips.)
5. **Curated `config/*.yaml` fails loud** (`raise`); scraped extractors warn-and-skip.

## Working here

- ETL: `python main.py` (warm cache at repo-root `.cache/` — don't wipe it;
  `HORSETRADER_SKIP_CACHE_REFRESH=1` for offline).
- Site: `cd horsetrader.site && npm test` is your fast loop. A dev server should
  be running on `:3000` — **probe and reuse it**, don't start your own.
- Don't re-enable `make deploy` (deliberately stubbed).

## What to work on

See **§3–§5 of the handoff**. Start with the `⭐` task (investigate issue #18 —
read-and-report, no risky changes). **Respect the "do NOT start blind" fence in
§5** — those are design-heavy and reserved for the weekday driver. A clear note
beats a confident wrong turn.
