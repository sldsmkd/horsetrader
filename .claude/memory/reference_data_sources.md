---
name: reference_data_sources
description: The data sources — official EN site (truth) + the three JP fan sources (Gametora/GameWith/wikiru)
metadata: 
  node_type: memory
  type: reference
  originSessionId: 369e281a-6e60-4bc3-bb00-656df75fed44
---

Sources fall into two roles: **first-party EN truth** (verify against, curate EN
overlays from) vs **JP fan sources** (predict from / source rewards). EN is
projected from JP per [[feedback_jp_is_substrate]] — so the official site is for
verification + EN-overlay curation, NOT a prediction substrate.

**First-party (EN truth):**

- **umamusume.com/news** ("the horse's mouth") + the monthly EN release-schedule
  images. Authoritative Cygames EN source: **official EN event names**, **exact
  UTC timestamps** (e.g. `2026/05/31 22:00 UTC` — the same 22:00/`+00:00`
  content-refresh time already in `stories.yaml`), giveaways/payloads via
  "Details" pages, Game/Media tagging. This is what "Actual"/ground-truth derives
  from, and the source of `en.name:` corrections (e.g. fansub "Seek, Solve,
  Summer Walk!" → official title). Settles the timezone-offset and official-name
  questions in the monthly forecast checks (`references/predictions/`).

**JP fan sources** (distinguished by *what kind of source they are*, not format):

- **Gametora** — *a database.* Canonical, queryable, stable shape → safe to
  ingest as a **live primary source** run-to-run (e.g. the story scrape). The
  only one wired into the hot path.
- **GameWith** (gamewith.jp) — *team-run, news-site-like.* More professional and
  **better-structured** than a pure community wiki; the **go-to for
  rewards/payloads, especially anniversary rewards.** Worth a fine-tooth-comb
  manual pass. Sits between Gametora and wikiru.
- **wikiru** (umamusume.wikiru.jp) — *pure community wiki.* Good for the broad
  **event index** (`イベント一覧`: per-category/per-year tables of window + name;
  payloads on per-event detail pages → index→detail two hops). Enumerates the
  special-event categories: ショータイム, 特別移籍, トレーナー技能試験,
  レーシングカーニバル, 目指せ！最強チーム, 因子研究, マスターズチャレンジ, GW —
  plus the already-handled story / CM / legend / [[project_league_of_heroes_todo]].

**How to apply:** ingest only Gametora live. Treat GameWith/wikiru as **one-off
bootstrap extracts → curated human-maintained YAML** (never live primary
sources — see [[project_showtime_closed_series]] for the bootstrap-not-ingester
rationale). For rewards/anniversary payloads reach for GameWith; for the
special-event window+name index reach for wikiru. Use the official EN site to
verify forecasts and to fill official EN names/windows in curated overlays.
