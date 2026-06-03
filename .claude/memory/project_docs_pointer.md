---
name: project-docs-pointer
description: "The backend has a full docs/ tree at the repo root (/home/kris/code/horsetrader/) that is the single source of truth — onboarding, architecture, semantics, standards, data sources, prediction, domain knowledge. Read it before answering structural or design questions."
metadata:
  node_type: memory
  type: project
  originSessionId: cea26d89-c459-4ce5-a935-d7c3d33405e6
---

The repo's `docs/` tree (`/home/kris/code/horsetrader/docs/`) is **the single
source of truth** and now documents **both** sides of the project (the frontend
docs were folded in from the `horsetrader.site` repo — [[project-workspace-split]]):
`docs/etl/` (the Python pipeline), `docs/frontend/` (the planner), crosscutting
`docs/contract.md` (the etl↔site bundle interface) + `docs/domain.md` (game
knowledge), and `docs/references/` (a catch-all junk drawer — scraps/announcements/old research, not authoritative, not pipeline input).

Index: [`docs/README.md`](../../../code/horsetrader/docs/README.md).

The repo root also has a thin [`AGENTS.md`](../../../code/horsetrader/AGENTS.md)
pointer to the same place. (`CLAUDE.md` and `agent.MD` from earlier prototypes
were deleted — their content is obsolete or migrated into `docs/`.)

**Why:** The user switches LLMs frequently due to token budgets and wants
context coherent across sessions and models. Putting the canon in `docs/`
(travels with the repo) rather than per-machine memory (local-only) is
what makes that work.

**How to apply:**
- Before answering anything structural ("how is X organised?", "where
  does Y belong?", "what's the convention for Z?"), check `docs/` first
  — there's almost certainly a relevant page.
- The character-named module convention has its canonical home at
  [`horsetrader/semantics/overview.md`](../../../code/horsetrader/horsetrader/semantics/overview.md);
  [`docs/etl/semantics.md`](../../../code/horsetrader/docs/etl/semantics.md)
  is the gateway.
- If a doc and this memory disagree, **the doc wins** — update the
  memory or delete it.
- If a doc is wrong or stale, fix the doc rather than working around it
  in conversation. Stale docs are worse than no docs.
- Don't duplicate doc content back into new memory entries. Memory is
  for harness/workspace context and user preferences, not codebase facts.

Related: [[project-workspace-split]], [[project_build_pipeline]].
