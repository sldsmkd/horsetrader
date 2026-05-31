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
| `references/announcements/*.jpg` | Local images | Human-eye source for `static/en.*.yaml` updates | (manual) |
| `static/img/stories/*.png` | Local images | Story event banners, consumed by ETL via `extractors/static/stories.py` | (manual) |

Cache lives at `$HORSETRADER_TARGET/.cache/`. Binary assets and index pages
have separate TTLs (see [`horsetrader/enums/CacheTime`](../horsetrader/enums/)).

## Stable-key scheme

Every model id is a [`StableKey`](../horsetrader/core/stable_key.py) of the form
**`<type>-<body>`** — a fixed namespace token first, so any key is routable by
splitting on the first `-`. The body is either a game-db id (Gametora) or an
invented slug/sequence.

| Namespace | Key shape | Example |
| --- | --- | --- |
| character | `char-<slug>` | `char-oguri-cap` |
| support | `support-<id>-<slug>` | `support-10001-special-week` |
| trainee | `trainee-<id>-<slug>` | `trainee-100101-special-week` |
| banner | `banner-<id>` | `banner-30003` |
| scenario | `scenario-<nn>` | `scenario-01` |
| story | `story-<nnn>` | `story-001` |
| cm | `cm-<nnn>` | `cm-001` |
| anchor | `anchor-<kind>-<ver>` | `anchor-new-year-2022`, `anchor-anni-3_0` |
| anchored event | `before-` / `after-<body>` | `after-new-year-2022` |
| item | `item-<id>` | `item-00043` |

Notes that are load-bearing, not cosmetic:

- **Entity ids stay in the body.** The game id is the genuinely stable anchor;
  the prefix is added at construction via a `KEY_PREFIX` ClassVar on each entity
  model. The slug after it is human-readable garnish (banner pickups still match
  characters on the bare slug, so the banner index strips `char-` before
  matching — see [`banner.py`](../horsetrader/models/events/banner.py)).
- **`anchor-<kind>-` is parsed.** `kind` (new-year / golden-week / anniversary)
  is read back off the prefix and routes the predictor chain — see
  [prediction.md](prediction.md). Don't reshape anchor keys without keeping
  `<kind>` recoverable.
- **Anchored events are relation-led.** The `before-` / `after-` prefix *is* the
  namespace and is also the `relation` field. `during-` is **YAML authoring
  sugar** — at load it (and any `anchor:` chain reference to it) normalises to
  `after-`; two keys that collapse to the same key raise. So the stable key only
  ever shows `before-` / `after-` (see
  [`extractors/static/anchored.py`](../horsetrader/extractors/static/anchored.py)).
- **Curated YAML keys are these stable keys byte-for-byte** (the one exception
  being the `during-`→`after-` sugar above). A `static/extractors/*.py`
  `_KEY_PATTERN` selects each corpus's rows by this shape — change a key format
  and its pattern moves with it.
- **Reward keys are not stable keys.** They're a fixed serialisation vocab
  bundled under an event's `rewards` object (`{"carats": 2160,
  "support_tickets": 2, …}`) — bare + pluralised, since the `rewards` wrapper
  already namespaces them, so the client reads one object rather than scanning
  top-level keys. A repeating bonus appears under `generator`
  (`{"carats": 564, "repeat": 10}`).

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
[`static/yaml/scenarios.yaml`](#static-yaml-files) below.

## Umapyoi

Lighter scraper used for enrichment after the Gametora pass. Hits the
character detail endpoint, list and mapping/tag resolution endpoints, and
the outfit endpoint during trainee enrichment. Hands records back to the
appropriate `_enrich_…` method on each `TracenModels`.

## Static YAML files

Hand-curated and scraper-immune. The loaded corpus lives under
[`static/yaml/`](../static/yaml/) (read via `Config().static_yaml`); **every
`*.yaml` there is auto-merged by the store — no whitelist.** Reference-only or
not-yet-wired files sit in [`static/pending/`](../static/pending/) instead,
outside the loaded set.

| File | Status | Purpose |
| --- | --- | --- |
| [`static/yaml/holidays.yaml`](../static/yaml/holidays.yaml) | **Consolidated.** | Holiday anchors: `anchor-new-year-YYYY` and `anchor-golden-week-YYYY` entries, an optional region-agnostic `rewards:` (curated login bonus) and `jp:` / `en:` blocks each holding a FQ ISO `start:`. Read by `extractors/static/holidays.py`; loaded with anniversaries into the unified `Anchors` collection. Also hosts the New Year anchored events inline (`before-`/`during-`/`after-`). Golden Week's themed name now rides the anchored spans, not the anchor (the `name:` lines are kept commented as a hand-off). |
| [`static/yaml/stories.yaml`](../static/yaml/stories.yaml) | **Consolidated.** | EN overlay for the Gametora-scraped JP story corpus. Each entry has an `en:` block with FQ ISO `start:` / `end:` (22:00 UTC) and an optional `name:` overriding Gametora's scraped EN title (fansub default; replaced with the Cygames-official title when shipped). YAML keys are zero-padded stable keys (`story-NNN`). Joined by `Static.story_period()` + `Static.story_name_override()`. |
| [`static/yaml/banners.yaml`](../static/yaml/banners.yaml) | **Consolidated.** | EN confirmed banner periods, keyed by `<id>-banner`, each under an `en:` block with FQ ISO `start` / `end` (22:00 UTC). Read by `extractors/static/banners.py` (via the merged store); stamps a UTC `Period` onto the matching `Banner` at extraction time. A banner absent here stays predicted. |
| [`static/yaml/scenarios.yaml`](../static/yaml/scenarios.yaml) | **Consolidated.** | Full JP scenarios corpus + EN overlay, keyed by zero-padded stable key (`scenario-NN`, release order). Each entry has a `jp:` block (`name`, JP `start` 12:00 JST), an `en:` block (`name` = EN title; `start` 22:00 UTC, present only once it's on Global), and a region-agnostic `art:` URL. Read by `extractors/static/scenarios.py`. Used directly because Gametora's scenarios page is JS-rendered, brittle, and not worth scraping. |
| [`static/yaml/anniversaries.yaml`](../static/yaml/anniversaries.yaml) | **Consolidated.** | JP anniversary corpus + EN overlay, keyed `anchor-anni-N_M` (e.g. `anchor-anni-1_0`, `anchor-anni-0_5`). Each entry has a `jp:` block (`start` 12:00 JST) and an optional `en:` block (`start` 22:00 UTC, present only once on Global). Read by `extractors/static/anniversaries.py`; loaded with holidays into the unified `Anchors` collection. |
| [`static/pending/_en.schedule.yaml`](../static/pending/_en.schedule.yaml) | **Reference only — out of scope.** | Mainline EN event + CM dates from the Cygames monthly announcements (image archive in [`references/`](../references/)). Lives in `static/pending/`, which is what keeps it out of scope — reference documentation, not pipeline input, not consumed by any loader. |

### Consolidated yaml shape

`holidays.yaml`, `stories.yaml`, `scenarios.yaml`, `anniversaries.yaml`, and
`banners.yaml` all follow it (the split `jp.*` / `en.*` forms are fully
retired). The pattern:

```yaml
<stable-key>:
  <region-agnostic field>: ...   # e.g. holidays' `rewards:`
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
- **Names**: `jp.name` is the JP title; `en.name` is the EN title, preferred
  for EN display when present. (Whether a given `en.name` is a community fansub
  or the official Cygames wording is a data-quality matter, not the loader's
  concern — it just reads the string.) Stories differ in *mechanism*:
  `stories.yaml`'s `en.name` overrides the live Gametora-scraped title at
  extraction, rather than sitting beside a curated JP name.
- **Region-agnostic fields** (e.g. holidays' `rewards:` login-bonus block,
  scenarios' `art:` URL) sit at the top level alongside the region blocks.
  Loaders pull these via `store.shared()`.
- **Scope is the directory, not the filename.** Everything in `static/yaml/`
  loads — no whitelist, no per-file marking. Out-of-scope files live elsewhere:
  `static/pending/` (not-yet-wired) and `references/import/` (pre-split YAML
  scraps kept for reference).
- **Fail loud**: curated YAML is hand-typed. Validation failures raise
  `ValueError` with `<path>: <entity> '<key>' <field> ...` so the
  editor sees the error on the next pipeline run while the YAML is
  still open in their IDE. No `warning + skip` for curated YAML.

#### Loader split: store primitives vs. entity logic

[`extractors/static/store.py`](../horsetrader/extractors/static/store.py)
holds the generic layer — **a single merged keystore.** It globs every
`*.yaml` in `static/yaml/` (no whitelist — drop a file in and it's loaded) and
merges them into one in-memory corpus keyed by stable key. **Filenames are
organisational, never semantic:** a key resolves the same wherever it's
authored, and loaders ask for *their* entries **by key pattern**, not by file —
so entries can move between files freely. The API:

- `select(pattern)` — the keys matching a stable-key shape (e.g.
  `^scenario-\d{2}$`), corpus-wide. Each loader's pattern claims a disjoint
  slice; this is the only "which rows are mine" query.
- `overlay(key, locale)` — per-(key, locale) block, or `None`.
- `shared(key)` — region-agnostic top-level fields on the entry.
- `find(key)` — the raw entry for any stable key (cross-corpus lookup).
- `source()` — generic provenance (the corpus directory); loaders and models
  never name a file.
- `load(filename)` — low-level single-file parser; backs the merge.
- `require_zone(value, expected, label)` — fail-loud tz validator.

A stable key defined in two files fails loud at merge time (keys are
globally unique by design). Each entity loader (`holidays.py`,
`anniversaries.py`, `scenarios.py`, `stories.py`, `banners.py`, and
`anchored.py` for the `before-`/`during-`/`after-` events) drives these with
its own `_KEY_PATTERN`, required regions, and output container shape. The
philosophy is **work from the back**: the merge lifted itself into
`store.py` only once the region loaders rhymed on the per-region shape.

#### Per-file extras

- Scenario keys: `scenario-NN`, zero-padded **release-order** integers. The
  display order on Gametora occasionally differs from release order — the
  `art:` URLs for `scenario-03` and `scenario-04` are deliberately swapped
  relative to Gametora's display order. Don't "fix" them.
- Banner keys (`banners.yaml`): `<gametora-id>-banner` (e.g.
  `30002-banner`).

### Out-of-scope holding pens

Two homes for YAML the ETL doesn't read:

- [`static/pending/`](../static/pending/) — reference docs and anything staged
  for a near-term port (e.g. `_en.schedule.yaml`).
- [`references/import/`](../references/import/) — loose scraps of pre-split
  YAML (`missions.yaml`, `login_bonus.yaml`, `free_pulls.yaml`,
  `cm_tracks.yaml`, `search_aliases.yaml`, `schedule.yaml`): documentation /
  reference the maintainer will draw on as scope expands, not a structured
  port-queue. Lives under `references/` (the human-eye grab bag), not `static/`.

When wiring one in, move it into `static/yaml/` (where the store auto-picks it
up), give it the region-namespace shape, and add a row above describing it.

## `references/announcements/`

Archive of the monthly schedule images Cygames publishes in their
announcements. **Not consumed by the ETL** — they're for the maintainer to
eyeball when updating `static/yaml/banners.yaml` and `static/pending/_en.schedule.yaml`.
Naming convention: `YYYY_MM.jpg`, with named variants for special posts
(e.g. `2025_06_extra_banners.jpg`, `2026_04_golshi_week.jpg`). Don't
delete them after a YAML update — having the source-of-truth screenshot
saves a future "where did this date come from?" investigation.

### Sourcing and what they drive

Cygames posts the EN-server "Release Schedule" image to their socials on the
**1st of each month**. Easiest way to grab it is to google the month and pull
it from the Reddit post. This image is the **source of truth for every EN date
and EN localisation** of anything it contains — Legend Races, trainee/support
banners, Champions Meeting cups, story events, etc. — each with an explicit
`HH:MM, DD Mon – HH:MM, DD Mon (UTC)` window.

Workflow (same monthly cadence as the story banners above):

1. Save the image here as `YYYY_MM.jpg` (named variant for special posts).
2. Sleuth on [gametora](https://gametora.com/umamusume) to map each entry to
   its stable id / ordinal.
3. Update the relevant curated YAMLs under `static/` (`banners.yaml`,
   `anniversaries.yaml`, `scenarios.yaml`, `stories.yaml`, …) with the
   EN windows and any official localised names.

## `references/apologems/`

Screenshots of the irregular gifts Cygames drops into the in-game Presents box,
named by date (`DD-MM-YYYY.png`). Contents vary — carats plus assorted items
(Alarm Clocks, Training Boosters, etc.) — under various reasons ("…Giveaway",
maintenance compensation, bug fixes). *"Apologems"* is just the community
nickname for the whole catch-all. **Not consumed by the ETL** — these drops are
discretionary and have no predictable cadence, so there's nothing to model
today. Kept as a timestamped archive in case a pattern ever emerges worth
analysing.

Suspected pattern (unconfirmed, not yet traced): these may track **JP marketing
beats** that don't map onto global's smaller numbers, so global rebrands them as
generic "…Giveaway" presents that turn up whenever the JP beat lands — which is
why they look random here. The triggers look eclectic, though: some are
systematic and calendar-traceable (download-count milestones — "7 million
downloads!"), others are essentially unpredictable real-world one-offs (e.g. the
Cygames president's racehorse winning a major race). So expect *partial*
correlation against the JP milestone/announcement calendar at best, not a clean
curve — and a low-priority, low-volume source either way.

## `static/img/stories/`

Story event banner images, named `story_NN_banner.png` (1-based integer
ordinal, no zero-pad requirement). Unlike the `references/` images these are
**consumed by the ETL** via `extractors/static/stories.py`, which is why they
live under `static/` (pipeline input) rather than `references/` (human-eye
only). `Stories._assign_banners()` date-sorts all story events and pairs them
with these files in ordinal order, then publishes each via `CurrenChan` as
`story-NNN-banner.webp`. When a new story event is added to the game, drop its
banner PNG here — the ordinal drives the stable-key match, so filename order
must match release order.

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

- **Trainees:** index by `(character slug, CostumeVariants)` — the bare slug,
  i.e. the character key with its `char-` prefix stripped, since pickups are
  matched on the slugified pickup name. Fall back to the canonical (`DEFAULT`)
  variant when the variant lookup fails.
- **Supports — new cards:** match by release date.
- **Supports — reruns:** match by **max release date before** the banner
  start. (The pickup is whichever support of that name was current.)
- **Welfare supports are excluded by design** — they're not gacha pulls.

Don't loosen these to "name-only fuzzy match." Drift in the source data
shows up as a missing match, and that's the signal you want.
