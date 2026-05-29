# Data sources

Where the ETL gets its inputs, which sources feed which collections, and
which files are hand-curated vs. scraped vs. auto-generated. The transport
layer ([`horsetrader/transport/`](../horsetrader/transport/)) is the only
place that talks to the network — everything else routes through `UmaClient`.

## Sources at a glance

| Source | Protocol | Feeds | Owned by |
| --- | --- | --- | --- |
| Gametora | HTTP + Selenium (some pages are JS-rendered) | Characters, Trainees, Supports, Banners, Stories, JP event dates | `@transcend` (uses `@shakur`) |
| Umapyoi | HTTP | Character / Trainee enrichment | `@transcend` (uses `@shakur`) |
| `static/*.yaml` | Local YAML | Consolidated per-event corpora (JP + EN dates, names, overrides); JP scenarios corpus | `@transcend` (`extractors/static/`) |
| `references/*.jpg` | Local images | Human-eye source for `static/en.*.yaml` updates | (manual) |
| `references/stories/*.png` | Local images | Story event banners, consumed by ETL via `extractors/static/story.py` | (manual) |

Cache lives at `$HORSETRADER_TARGET/.cache/`. Binary assets and index pages
have separate TTLs (see [`horsetrader/enums/CacheTime`](../horsetrader/enums/)).

## Gametora

The primary scraper target. Some pages are static HTML and fetched via
plain HTTP; others (notably the scenarios page) are JS-rendered React and
require the headless Chrome path on `UmaClient.get(..., chrome=True)`.

Extractors live in [`horsetrader/extractors/gametora/`](../horsetrader/extractors/gametora/):

- `characters.py` / `character.py` — character index + detail.
- `trainees.py` / `trainee.py` — trainee (outfit) records, two-pass image
  inference.
- `supports.py` / `support.py` — support card index + detail. Image URLs
  inferred from `support_id`:
  - thumb: `…/supports/support_card_s_{id}.png`
  - art: `…/supports/tex_support_card_{id}.png`
- `banners.py` — banner records, JP dates parsed into `Period`s, mixed
  trainee/support typing under the same gacha-history page.
- `story.py` — story-event index + detail pages (`GametoraStories` and
  `GametoraStory` in one file). Both are JS-rendered and require
  `chrome=True`. The index (`/ja/umamusume/events/story-events`) yields
  `title_jp` and `art_url` (hero image reconstructed from the
  `thumb_title` URL). Each detail page is fetched twice — once at `/ja/…`
  for the JST period timestamps, `icon_url`, `trainee_ids`, and
  `support_ids`; once at `/umamusume/…` (EN locale) for `title_en` (with
  the `" Story Event"` suffix stripped).
- `dates.py` — Gametora-specific date parsing helpers (timestamps stamped
  12:00 JST — see [domain.md](domain.md) for why).

The **JS-rendered scenarios page is off-limits** — see
[`static/jp.scenarios.yaml`](#static-yaml-files) below.

## Umapyoi

Lighter scraper used for enrichment after the Gametora pass. Hits the
character detail endpoint, list and mapping/tag resolution endpoints, and
the outfit endpoint during trainee enrichment. Hands records back to the
appropriate `_enrich_…` method on each `TracenModels`.

## Static YAML files

Hand-curated and scraper-immune. All live under
[`static/`](../static/) and are read via `Config().static`.

| File | Status | Purpose |
| --- | --- | --- |
| [`static/holidays.yaml`](../static/holidays.yaml) | **Consolidated.** | Holiday corpus: `new-year-YYYY` and `golden-week-YYYY` entries, region-agnostic `name:` (optional) and `jp:` / `en:` blocks each holding a FQ ISO `start:`. Read by `extractors/static/holidays.py`. |
| [`static/stories.yaml`](../static/stories.yaml) | **Consolidated.** | EN overlay for the Gametora-scraped JP story corpus. Each entry has an `en:` block with FQ ISO `start:` / `end:` (22:00 UTC) and an optional `name:` overriding Gametora's scraped EN title (fansub default; replaced with the Cygames-official title when shipped). YAML keys are zero-padded stable keys (`story-NNN`). Joined by `Static.story_period()` + `Static.story_name_override()`. |
| [`static/en.banners.yaml`](../static/en.banners.yaml) | **Manually curated.** | EN confirmed banner periods, keyed by `<id>-banner`. Read by `extractors/static/banners.py`; stamps a UTC `Period` onto the matching `Banner` at extraction time. |
| [`static/jp.scenarios.yaml`](../static/jp.scenarios.yaml) | **Manually curated; queued for merge.** | Full JP scenarios corpus, keyed `scenario-N` (release-order integer). Carries `en` title (fansub), `jp` title, JP `start`, and `art` URL. Used directly because Gametora's scenarios page is JS-rendered, brittle, and not worth scraping. Will merge into a consolidated `scenarios.yaml` following the [shape below](#consolidated-yaml-shape). |
| [`static/en.scenarios.yaml`](../static/en.scenarios.yaml) | **Manually curated; queued for merge.** | EN scenario titles (official Cygames) and confirmed EN `start`. Joined onto `jp.scenarios.yaml` via the `scenario-N` key by `Static.scenarios()`. The `en:` field here is the **official** EN title and overrides the fansub from `jp.scenarios.yaml` once merged. |
| [`static/jp.anniversaries.yaml`](../static/jp.anniversaries.yaml) | **Manually curated; queued for merge.** | JP anniversary corpus, keyed `anni-N_M` (e.g. `anni-1_0`, `anni-0_5`). Drops at 12:00 JST. Queued for merge into consolidated `anniversaries.yaml`. |
| [`static/en.anniversaries.yaml`](../static/en.anniversaries.yaml) | **Manually curated; queued for merge.** | EN confirmed anniversary `start` dates. Joined by `Static.anniversaries()`. |
| [`static/_en.schedule.yaml`](../static/_en.schedule.yaml) | **Reference only — out of scope.** | Mainline EN event + CM dates from the Cygames monthly announcements (image archive in [`references/`](../references/)). Underscore prefix marks it as reference documentation, not pipeline input — kept for maintainer lookup but not consumed by any loader. |

### Consolidated yaml shape

`holidays.yaml` and `stories.yaml` already follow it; `anniversaries.yaml`
and `scenarios.yaml` will when they're merged from their split forms.
The pattern:

```yaml
<stable-key>:
  <region-agnostic field>: ...   # e.g. holidays' `name:`
  jp:
    start: 2022-01-01T05:00:00+09:00   # FQ ISO timestamp, JST offset
    name: ...                          # per-region fields nested here
  en:
    start: 2026-01-27T22:00:00+00:00   # FQ ISO timestamp, UTC
    name: ...                          # optional, overrides jp.name on EN
```

Rules:

- **Top-level keys are stable keys**, byte-for-byte. No upstream-vendor
  formats (Gametora's unpadded `story-1` becomes the padded stable
  `story-001`), no normalisation step in the loader.
- **Region blocks** (`jp:` / `en:`) hold per-region fields. Which blocks
  are required depends on the entity: holidays require `jp:`, stories
  require `en:`. The blocks are not optional in their required role;
  fail-loud on missing.
- **Timestamps are fully qualified** — date, time, and offset all in the
  YAML. Drop-time conventions (NY 05:00 JST, GW 12:00 JST, EN 22:00 UTC)
  are documented in each file's header comment but enforced by the data.
  Loader cross-validates that the offset matches the block's expected
  zone (`jp.start.tzinfo == JST`, `en.start.tzinfo == UTC`).
- **Names follow a precedence rule**: a `jp:`-side name is the JP title /
  fansub default; an optional `en.name:` is the Cygames-official EN
  translation and overrides the default at consumer time. See
  `static/jp.scenarios.yaml` for the canonical fansub-vs-official split
  that defined this rule.
- **Region-agnostic fields** (e.g. holidays' `name: Golshi Week`, the
  hypothetical scenario `art:` URL) sit at the top level alongside the
  region blocks. Loaders pull these via `store.shared()`.
- **`_*.yaml`** filenames (leading underscore) are reference-only —
  kept for maintainer lookup, not read by any loader.
- **Fail loud**: curated YAML is hand-typed. Validation failures raise
  `ValueError` with `<path>: <entity> '<key>' <field> ...` so the
  editor sees the error on the next pipeline run while the YAML is
  still open in their IDE. No `warning + skip` for curated YAML.

#### Loader split: store primitives vs. entity logic

[`extractors/static/store.py`](../horsetrader/extractors/static/store.py)
holds the small generic layer:

- `load(filename)` — cached YAML I/O + structural mapping check.
- `overlay(filename, key, locale)` — per-(key, locale) block, or `None`.
- `shared(filename, key)` — region-agnostic top-level fields on the entry.
- `require_zone(value, expected, label)` — fail-loud tz validator.

Each entity loader (`holidays.py`, `stories.py`, future
`anniversaries.py` / `scenarios.py`) drives those primitives with its
own key pattern, required regions, and output container shape. The
philosophy is **work from the back**: start with the smallest shared
primitives; lift more into `store.py` only when 3 of 4 loaders rhyme on
a pattern.

#### Per-file extras

- Scenario keys: `scenario-N`, **release-order** integers. The display
  order on Gametora occasionally differs from release order — the
  `art:` URLs for `scenario-3` and `scenario-4` are deliberately swapped
  relative to Gametora's display order. Don't "fix" them.
- Banner keys (`en.banners.yaml`): `<gametora-id>-banner` (e.g.
  `30002-banner`).
- "Forever" sentinel: `9999-12-31` for open-ended scenarios (split-file
  scenarios only — date-only until that file merges).

### Legacy / queued imports

[`static/import/`](../static/import/) holds the older, pre-split tree's
data files: `missions.yaml`, `login_bonus.yaml`, `free_pulls.yaml`,
`cm_tracks.yaml`, `search_aliases.yaml`, `schedule.yaml`. None of these
are currently read by the new ETL — they're staged for porting. When
wiring one in, decide its status (manual vs. auto-generated) and add a
row above with a link to whichever extractor consumes it.

## `references/` images

Archive of the monthly schedule images Cygames publishes in their
announcements. **Not consumed by the ETL** — they're for the maintainer to
eyeball when updating `static/en.banners.yaml` and `static/_en.schedule.yaml`.
Naming convention: `YYYY_MM.jpg`, with named variants for special posts
(e.g. `2025_06_extra_banners.jpg`, `2026_04_golshi_week.jpg`). Don't
delete them after a YAML update — having the source-of-truth screenshot
saves a future "where did this date come from?" investigation.

### `references/stories/`

Story event banner images, named `story_NN_banner.png` (1-based integer
ordinal, no zero-pad requirement). **Consumed by the ETL** via
`extractors/static/story.py`. `Stories._assign_banners()` date-sorts all
story events and pairs them with the reference files in ordinal order, then
publishes each via `CurrenChan` as `story-NNN-banner.webp`. When a new
story event is added to the game, drop its banner PNG here — the ordinal
drives the stable-key match, so filename order must match release order.

## The transport boundary

All network I/O goes through [`UmaClient`](../horsetrader/transport/uma_client.py):

- `client.get(resource, chrome=False, cache=...)` — strict; raises on
  non-200.
- `client.try_get(resource, ...)` — tolerant; returns `None` on missing /
  404. Negative-caches the sentinel so a known-bad URL doesn't get
  retried inside the TTL.
- `UmaClientCache` is **internal** — do not read or write it from
  outside the transport module.
- HTTP errors are surfaced as `HttpError(message, status_code)`. Do
  **not** string-match on transport error messages from caller code;
  catch on the type or react to `status_code`.

The Chrome session is lazily created on first JS-rendered fetch and
re-used. A stale-session error transparently triggers re-creation
inside `UmaClient` — callers don't see it.

## Banner contents matching

When a `Banner` payload lists pickup characters / trainees / supports,
matching to live entities follows fixed rules. These live in the entity
code but the matching rules are part of the data contract:

- **Trainees:** index by `(character_key, CostumeVariants)`. Fall back to
  the canonical (`DEFAULT`) variant when the variant lookup fails.
- **Supports — new cards:** match by release date.
- **Supports — reruns:** match by **max release date before** the banner
  start. (The pickup is whichever support of that name was current.)
- **Welfare supports are excluded by design** — they're not gacha pulls.

Don't loosen these to "name-only fuzzy match." Drift in the source data
shows up as a missing match, and that's the signal you want.
