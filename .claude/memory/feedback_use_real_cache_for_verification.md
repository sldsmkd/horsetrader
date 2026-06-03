---
name: feedback-use-real-cache-for-verification
description: "For verification / smoke-test Bash, use the warm shared cache and don't blow it away. As of 2026-06-01 the cache lives at the repo root (`.cache/`), decoupled from `HORSETRADER_TARGET`."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 580b8fd7-8684-4f4e-a9d6-c2571eae552a
---

When running quick verification scripts via Bash in this project, **use the real warm cache and don't blow it away**. Forcing a cold cache makes real scrapes against Gametora / Umapyoi, which is slow and pollutes upstream rate-limit budgets.

**As of the 2026-06-01 monorepo move the cache moved to the repo root:** `/home/kris/code/horsetrader/.cache/` (~1.6 GB warm). `Config.cache` resolves it from `_repo_root` (the dir with `.git`/`.env`), so it is now **decoupled from `HORSETRADER_TARGET`**. (The output root is now also repo-root `static/` via `Config.static`, so `HORSETRADER_TARGET`/`_target()` are vestigial dead code — see [[project_build_pipeline]].) Consequence: overriding `HORSETRADER_TARGET=/tmp/...` **does nothing** — neither the warm repo-root cache nor the `static/` output honour it. To genuinely cold-start now you'd have to delete/redirect `.cache/` itself.

**Why:** Said by the user on 2026-05-29 after I ran a smoke test with `HORSETRADER_TARGET=/tmp/ht-verify ./venv/bin/python -c "...; Stories(); ..."` — instantiating `Stories()` triggered a full eager `TracenModels` load (per the [docs/architecture.md](../../../code/horsetrader/docs/architecture.md) invariant), which against an empty cache meant a cold scrape of the entire story index. User flagged that I should default to the real cache: *"I think we can make a note to use the real cache unless we're testing specifically caching."* (The cache→target coupling that caused this has since been removed, but the don't-cold-start instinct stands.)

**How to apply:**

- Default verification command: `./venv/bin/python -c "..."` (no env override). The cache resolves to `/home/kris/code/horsetrader/.cache/` regardless of target.
- Treat `/home/kris/code/horsetrader/.cache/` as warm and shared — don't delete it. It's gitignored.
- Only deliberately cold-start (redirect/delete `.cache/`) when the test is specifically about cache write/read/expiry behaviour; clean up the throwaway afterward.
- Related: instantiating any `TracenModels` collection (`Stories()`, `Banners()`, `Trainees()`, …) triggers `_fetch()` from the constructor — "eager loading, intentionally N+1" per [docs/architecture.md](../../../code/horsetrader/docs/architecture.md). Don't import-and-call these in a "lightweight" smoke test; verify the loader/facade layer directly instead.
