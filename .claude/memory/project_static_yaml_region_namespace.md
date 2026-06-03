---
name: project-static-yaml-region-namespace
description: "Merged static yamls use `jp:` / `en:` as namespaces (per-region fields like `start`), not scalars. All `*.yaml` in `config/yaml/` are auto-globbed + merged by the store (no whitelist); reference/not-yet-wired files go in `config/pending/`. Split `jp.*`/`en.*` forms retired (2026-05-30)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 580b8fd7-8684-4f4e-a9d6-c2571eae552a
---

The consolidated static-data YAML pattern (introduced 2026-05-29 in `config/holidays.yaml`, replacing `jp.holidays.yaml` + `en.holidays.yaml`):

```yaml
golden-week-2022:
  name: Golshi Week                       # region-agnostic; top level
  jp:
    start: 2022-04-28T12:00:00+09:00      # FQ ISO timestamp (date + time + offset)
  en:
    start: 2026-04-26T22:00:00+00:00      # EN block optional; same FQ shape
```

Timestamps are **fully qualified** — date, time, and offset all live in the YAML. Drop-time conventions (NY 05:00 JST, GW 12:00 JST, EN 22:00 UTC) are documented in the file header but enforced by the data, not by a `_drop_hour()` helper in the loader. YAML 1.1 timestamps parse to `datetime` with `tzinfo` that compares equal to `horsetrader.core.JST` / `UTC` (verified), so predictors doing `p.tzinfo == JST` keep working.

**Gotcha:** the timestamp must be **unquoted** in the YAML (`start: 2022-04-28T12:00:00+09:00`). Quoting it (`start: "...+09:00"`) makes PyYAML keep it a *string*, and `store.require_zone` rejects strings — fail-loud with "must be an ISO timestamp in <tz>". Bit the scenarios.yaml merge (2026-05-30); names stay quoted, timestamps don't.

**Why:** The split-file shape (one yaml per region) made it easy to miss "JP has this, EN doesn't yet" gaps. Combining trades that for nested parsing in the loader but localises every event's full state to one block. Picked `jp:` / `en:` as *namespaces* (mappings) rather than scalars to avoid the legacy scenarios trap where `en:` is a scalar string in `jp.scenarios.yaml` (a name) but means something different in `en.scenarios.yaml`. Namespaces generalise to multiple fields per region (`start`, `name`, future `countdown`, etc.).

**Store = a merged keystore (2026-05-30):** `store.py` globs every `*.yaml` in `config/yaml/` (`Config().curated_yaml`) and merges into one in-memory corpus keyed by stable key — no whitelist, no per-file skip; drop a file in and it's loaded. **Filenames are organisational, not semantic** — a key resolves the same wherever it's authored. Loaders select their rows **by key pattern**, corpus-wide, via `store.select(pattern)`; each loader owns a `_KEY_PATTERN` claiming a disjoint shape: holidays `^anchor-(new-year|golden-week)-\d{4}$`, anniversaries `^anchor-anni-\d+_\d+$`, scenarios `^scenario-\d{2}$`, stories `^story-\d{3}$`, banners `^\d+-banner$`, anchored `^(before|during|after)-`. Rest of the API: `store.overlay(key, locale)`, `store.shared(key)`, `store.find(key)` (raw entry for any key), `store.source()` (**generic provenance** = the corpus dir; used for References + error labels — never a filename), `store.load(filename)` (low-level parser backing the merge). Duplicate key across files fails loud at merge. (`banners.yaml` is en-only — loader requires `en:`.) **Tradeoff:** no orphan-key guard — a key matching no loader's pattern (e.g. a typo) is silently unused rather than failing loud.

**Anchored events inline (2026-05-30):** `anchored.yaml` retired — anchored events (lead-ins/extensions; keys `before-`/`during-`/`after-` carrying `anchor`/`duration`/`name`, no locale blocks) are **inlined into any file** beside their anchor (NY ones live in `holidays.yaml`). `anchored.py` selects them via `store.select(^(before|during|after)-)` and resolves each with `store.find(key)`; the prefix also sets direction (`before` vs `after`; `during` = `after` synonym). Authoring crib: `config/yaml/anchors.txt` (not loader-read).

**How to apply:** all five corpora are merged (split `jp.*`/`en.*` forms retired; `en.banners.yaml` → `banners.yaml`). For a *new* dataset: author the YAML in `config/yaml/` (any file, or a new one — auto-loaded) in the region-namespace shape, then write a loader that (1) defines a `_KEY_PATTERN` for its stable-key shape, (2) iterates `store.select(_KEY_PATTERN)`, (3) reads blocks via `store.overlay(key, locale)` / `store.shared(key)`, (4) labels errors with `store.source()`. `extractors/static/anniversaries.py` is the minimal reference; `scenarios.py` adds per-region `name` handling. The `en:` block is optional — entities with no confirmed EN date omit it; where a `name` lives in `en:` it's just the EN string ([[project-scenario-name-precedence]] — fansub-vs-official is data quality, not modelled in code). Countdown event support is the planned next addition — likely as a nested `countdown:` block under each parent, emitted as a sibling event with a derived stable key (deferred; see conversation 2026-05-29 for design options).
