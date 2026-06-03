---
name: project_site_consumer_workspace
description: horsetrader.site/ is the front end — a tracked subtree of the single horsetrader monorepo (its sub-repo was deleted 2026-06-01); JS/CSS now, aseprite icons later. It consumes the ETL bake; its docs live in docs/frontend/. Don't edit it from a backend session — that's a boundary crossing (workflow discipline, not a git boundary).
metadata:
  node_type: memory
  type: project
  originSessionId: e1ce75ba-6392-4e58-84bd-c15b4902a46b
---

The web front end lives at `/home/kris/code/horsetrader/horsetrader.site/` — a **tracked subtree of the single horsetrader monorepo**. It briefly had its own git repo (during the `site/` → `horsetrader.site/` rename) but that sub-repo was **deleted 2026-06-01** (only a few commits) and folded into the monorepo; only its `node_modules/` / `.wrangler/` are gitignored. The `horsetrader.` prefix sorts it right next to `horsetrader/` (the ETL package) in the tree. Its docs were consolidated into `docs/frontend/` ([[project-docs-pointer]]). Scope is the front end: JS + CSS today, **aseprite work (icons) in future**. **Don't edit it from a backend session and vice versa** — reaching across the backend↔site line in one session is the "ranging too far" smell; stop and warn. This boundary is **workflow discipline**, not a git or filesystem boundary — it's all one repo now.

Its **design and architecture now live in `docs/frontend/`** (zero-server static
TS planner — raw DOM, no framework, Cloudflare Pages, all compute on the user's
device; two `core/` pillars, persistence + projection; design-ahead-of-code) and
the **etl↔site interface in `docs/contract.md`** (it consumes the bake via a plain
typed cast; the bundle must carry game-data values for the procedural streams the
client expands). Those docs are the source of truth — don't mirror their detail
back into memory ([[project-docs-pointer]]).

There's no cross-side handoff file (the `generated/TODO.md` bridge was dropped
2026-06-01); a change needing both sides is scope creep → separate session. The frontend's own
Claude brain (the old `…-horsetrader-site` memory store) was merged into this one
on 2026-06-01; only its `design-altitude` feedback survived as
[[feedback-design-altitude]] — the rest was doc-mirrored.
