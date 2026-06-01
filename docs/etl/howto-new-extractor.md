# How-to: add a new end-to-end extractor

A recipe for wiring a new event (or entity) type from its source all the way
to the baked JSON, without getting lost. It is written against a real worked
example — **Champions Meetings** (`cm-NNN`) — added in exactly these steps. If
you are an LLM agent, follow it top-to-bottom; the ordering is the point.

## First principle: JP is the substrate, EN is projected from it

**Read this before anything else, and re-read it whenever you feel lost.** This
ETL exists to do one thing: take the *known* state of the **Japan** server and
project the **Global (EN)** schedule from it via correlations. The direction of
derivation is fixed and one-way:

```
JP (known, scraped)  ──correlate / predict──▶  EN (projected, then confirmed)
```

Consequences you must hold onto:

- **Every event's existence, identity, and stable key come from JP.** An event
  *is* its JP occurrence. No JP period → the event does not exist in this
  system. There is nothing to project from, nothing to key, nothing to bake.
  Build the **JP source first** (Step 2); it is non-optional.
- **EN is a derived layer, never a source of truth for existence.** The
  predictor projects an EN window onto every JP event; the curated EN YAML
  (Step 3) merely *confirms or refines* that projection once Global catches up.
  The YAML can only ever describe events JP already gave us.
- **The seductive trap (this is exactly where agents get lost):** you'll find a
  tidy curated EN YAML and start treating it as the dataset — building the model
  around it, keying off it, wondering why JP "doesn't fit." That is the model
  inverted. If you catch yourself starting from the EN file, **stop and go back
  to the JP scrape.** The YAML is the tail; JP is the dog.

For CM this is literal: the 45 occurrences, their `cm-NNN` keys, and their dates
all come from the JP Gametora index. The EN YAML covers only the ~14 that have
reached Global, and the other 31 ship fine as predictions — *because they exist
in JP*.

> The golden rule that keeps you out of the ditch: **recon the data and trace
> one existing slice before you write a line of parser** — starting from the JP
> source. Most failed attempts here start by writing against an imagined DOM, or
> by building around the EN YAML. Don't.

Pair this with [architecture.md](architecture.md) (the stage diagram),
[data-sources.md](data-sources.md) (sources + the consolidated YAML shape), and
[standards.md](standards.md) (fail-loud, etc.).

## The chain you are building

Every event type travels the same path. Know all of it before touching any of it:

```
source (scrape and/or curated YAML)
  → extractor          (extractors/<source>/<thing>.py) — returns record dicts + core primitives
  → facade method      (Gametora / Static)              — the only entry models call
  → model + collection (models/events/<thing>.py)       — dataclass + TracenModels subclass
  → export             (models/events/__init__.py)      — makes it an auto-discovered stage
  → bake               (the event's own bake())         — events serialise themselves
```

Two facts make this tractable:

- **Auto-discovery.** A `TracenModels` subclass registers itself at
  class-definition time. Exporting your collection from the package `__init__`
  is the *entire* wiring step — `Pipeline`, `Bake.timeline`, `Predict`, and
  `Bake.events` all iterate the registry. **You never edit the pipeline.**
- **Events bake themselves.** `Bake.events` calls `event.bake(period)` directly
  (no mapper). Only *entities* (`academy.json`) go through `output/_mappers.py`.

## Step 0 — Recon first (do not skip)

Before designing anything, look at the actual source. Trace the closest
existing slice, then fetch the real data through `UmaClient` and probe its
shape. For CM, the closest analog was the **Banner**: Gametora-scraped JP
period + curated EN overlay. Yours will rhyme with *some* existing slice — find
it first.

Write a throwaway recon script (delete it when done — see Step 9). Use the real
transport so you exercise the cache and robots layer:

```python
from horsetrader.enums import CacheTime
from horsetrader.transport import UmaClient
from lxml import html
uc = UmaClient()
raw = uc.get(URL, chrome=True, cache=CacheTime.INDEX)   # chrome=True for JS-rendered pages
open("/tmp/recon.html", "w").write(raw)                 # save it; eyeball it
tree = html.fromstring(raw)
# probe: count the nodes you think you'll parse; print a few; assert your assumptions
```

What recon settled for CM, none of which was guessable from the code:

- The data lives on **two** Gametora pages sharing one ordinal keyspace: the
  `/ja/` index renders JP dates (old `YYYY年M月D日 H:MM` layout); the
  locale-less index renders a `<select>` of `<option value="N">N - Name</option>`
  EN names. JP dates from one, EN names from the other, joined by ordinal.
- The EN page is the authoritative name source across naming eras (zodiac cups
  `1–24`, then distance categories `MILE`/`DIRT`/`CLASSIC`/… from `25` on) —
  the names are *not* derivable, which justified the second fetch.
- Parse **discrete DOM nodes**, not whole-page `text_content()`: the `<option>`
  text butts against the next number ("Aries Cup25 - …"). Recon is where you
  catch that.

`chrome=True` opens a **visible** browser window (`with_chrome(headless=False)`);
that's expected.

## Step 1 — Settle the stable key (explicitly)

The stable key is the spine of the whole record. Decide it deliberately and
write down *why*:

- It must be **stable across re-runs and across the JP→Global transition.** CM
  uses the Gametora chronological occurrence ordinal: order never changes,
  occurrences only append, and the EN server replays JP's sequence in order, so
  `cm-001` (JP's first CM, 2021) is simply the same event Global reached in
  2025. Confirmed empirically, not assumed — the join proved `_en.schedule`'s
  `cm-7` = JA ordinal 7 (Scorpio, 2000m Tokyo).
- **Zero-pad to the real ceiling.** Scenarios use `scenario-NN`; stories and CM
  use 3 digits (`cm-001`) because 45+ occurrences already exist and 50+ are
  coming. A 2-digit width would wrap. Padding is part of the key.
- **Check it against any existing curated files.** CM keys already appeared
  (unpadded) in `references/import/cm_tracks.yaml` and
  `config/pending/_en.schedule.yaml`; confirming both used the same ordinal
  scheme is what proved there was no conflict. Curated YAML keys must be the
  stable key **byte-for-byte** — the loader does no normalisation.

## Step 2 — The extractor (the JP source — build this first, it's non-optional)

This is the substrate (see the first principle). It must yield a **JP `Period`
per event** from a JP source; everything downstream — keys, prediction, the EN
overlay — depends on it existing. If you can't get JP, stop: there is no event.

Lives in `extractors/<source>/<thing>.py`. Returns **record dicts and core
primitives** (`Period`, etc.) — never model instances; entity construction is
the model layer's job. Mirror the analog you found in Step 0.

Worked example: [`extractors/gametora/champions_meetings.py`](../../horsetrader/extractors/gametora/champions_meetings.py)
scrapes both pages, parses the JP `Period` from the `/ja/` date-divs, parses the
EN `{ordinal: name}` map from the `<select>`, sorts JP occurrences by start,
assigns `cm-{n:03d}`, and joins the name by ordinal. Notes:

- **`@transcend`, `SingletonMeta`, holds `UmaClient`.** Same skeleton as
  `GametoraBanners`.
- **Scraped data is warn-and-skip**, not fail-loud: a malformed row logs a
  warning and is dropped; only a wholesale failure (no rows at all) raises.
  (Curated YAML is the opposite — see Step 4.)
- **Parse what's listed, don't normalise to a convention you assume.** CM rounds
  open at the in-game hour (`4:00`/`3:00` JST), not the generic 12:00 banner
  drop, so CM keeps its own JP parser rather than reusing `dates.parse_period`.

Then expose it on the **facade** (`Gametora` in
[`extractors/gametora/__init__.py`](../../horsetrader/extractors/gametora/__init__.py)):
add the scraper to `__init__` and a one-line method. Models import the facade,
never the scraper class.

## Step 3 — The curated EN overlay (YAML) is *optional* and curator-owned

> **Do not assume this file exists, and do not fabricate it.** Your extractor,
> model, and enrichment hook are complete and correct *without a single curated
> row* — every occurrence simply comes out **predicted** (Step 7). That is a
> valid shipping state. The curated overlay is a separate, hand-authored input
> that the maintainer fills in with **real** EN data (from the monthly
> announcement image — see [data-sources.md](data-sources.md)) as each
> occurrence reaches Global. Your job is the *machinery* that reads it when it's
> there (Step 4); populating it is curation, not engineering.

When the overlay does get authored, it lives under `config/yaml/`
(auto-merged by the store — **no whitelist**) and follows the
[consolidated shape](data-sources.md#consolidated-yaml-shape): top-level stable
key, region blocks (`en:`), **fully-qualified ISO timestamps** with the right
offset.

- **Keys match the stable key** (`cm-001`), padded, byte-for-byte.
- **FQ timestamps from the real source.** Take the announced start/end (and
  time-of-day) verbatim. Don't carry over conventions from old holding-pen
  files — e.g. `references/import/cm_tracks.yaml` and the legacy
  `_en.schedule.yaml` had quirky assumptions (recording `end` as the *final
  competition day*, a day short of the true close). Inherit the *keys* from
  those files, not their date math.
- **A missing entry is not an error** — it means "not yet on Global," and the
  predictor fills it. A present-but-malformed entry **fails loud** (Step 4).
- **Cross-check the span once real rows land** (Step 8): a curated window and a
  predicted one for the same event type should agree on real-world duration
  (CM's are uniformly 6 days). A mismatch usually means a curation off-by-one.

## Step 4 — The static loader

A per-entity loader in `extractors/static/<thing>.py`, mirroring
[`config/banners.py`](../../horsetrader/extractors/static/champions_meetings.py)'s
sibling. It claims its slice of the merged store **by key pattern**:

```python
_KEY_PATTERN = re.compile(r"^cm-\d{3}$")
@functools.cache
def load() -> dict[str, Period]:
    for key in store.select(_KEY_PATTERN):
        en = store.overlay(key, "en")
        if en is None: raise ValueError(...)            # curated → FAIL LOUD
        start = store.require_zone(en.get("start"), UTC, f"...{key} en.start")
        ...
```

- **Curated YAML fails loud** — a present-but-malformed entry `raise`s with a
  `<path>: <entity> '<key>' <field>` message, so the run is the editor's
  feedback loop. (Absent entirely is fine — that just means "not yet on Global,"
  stays predicted.)
- `store.select` is the only "which rows are mine" query; the file an entry
  lives in is irrelevant.

Expose it on the **`Static` facade**
([`extractors/static/__init__.py`](../../horsetrader/extractors/static/__init__.py)):
one method, `cm_period(key) -> Period | None`.

## Step 5 — The model + collection

One file, [`models/events/champions_meeting.py`](../../horsetrader/models/events/champions_meeting.py):

- **`ChampionsMeeting(Event)`** — a `@daitaku @dataclass`. Add only the fields
  your type owns (`name`). Override `match` (add name search) and `bake`:
  `super().bake(period)` gives the shared envelope (`start`/`end`/`predicted`/
  `type`/`key`); add your fields. The base `type` is the lowercased class name;
  CM overrides it to the concise `"cm"` to match the key prefix.
- **`ChampionsMeetings(Events[ChampionsMeeting], metaclass=SingletonMeta)`** —
  the collection. Three methods do the work:
  - `_fetch_primary` — build entities from the **primary** source (the scrape),
    stamping the JP `Period` and per-record `references`.
  - `_enrichers` — return an ordered tuple of in-place mutators. The EN overlay
    is one: `Static().cm_period(cm.key)`, append the UTC `Period` if present.
    This is the JP-primary / EN-enrichment split, identical to `Banners`.
  - `_validate_item` — per-item sanity (warn if no name).

Two periods per event is the norm: a JST one from extraction and a UTC one
added at enrichment (`Periods` enforces ≤1 per tzinfo). `Predict` later adds a
*predicted* UTC period to events that still lack one.

## Step 6 — Export it (the only wiring)

Add the model + collection to
[`models/events/__init__.py`](../../horsetrader/models/events/__init__.py)'s
imports and `__all__`. That's it — auto-discovery does the rest. No edit to
`pipeline.py`, `bake.py`, `predict.py`, or `_mappers.py`.

## Step 7 — Prediction (usually free)

Events that reach `Predict` with only a JST period get a predicted UTC period
from the catch-all chain (DateMapper + FallthroughPredictor — see
[prediction.md](prediction.md)). CM needed **no** new predictor. With the
curated overlay (Step 3) empty, **all** occurrences come out predicted — a
complete, correct state. As curated rows are added, those flip to confirmed and
the rest stay predicted. Only add a predictor if your type needs bespoke
EN-date logic the catch-all can't supply.

## Step 8 — Verify incrementally

Test each layer in isolation as you build it — don't write all six files then
run once. Use the **real cache** (let `.env` win; don't override
`HORSETRADER_TARGET`).

```bash
# scraper alone — does the parse hold against the live/cached DOM?
venv/bin/python -c "from horsetrader.extractors.gametora.champions_meetings import GametoraChampionsMeetings; \
  print(GametoraChampionsMeetings().champions_meetings()[:2])"
# loader alone — returns None until a row is curated; once curated, zones validate
venv/bin/python -c "from horsetrader.extractors.static import Static; print(Static().cm_period('cm-001'))"
# collection alone — periods stamped, enrichment applied (if any), bake shape right
venv/bin/python -c "from horsetrader.models.events import ChampionsMeetings; c=ChampionsMeetings(); print(len(c))"
# full pipeline — cm-* in events.json; with an empty overlay they're all predicted
venv/bin/python main.py
```

With no curated overlay, confirm every occurrence is `predicted: true` with
sane spans — that alone is a complete, shippable result. **Once curated rows
exist**, the decisive check (the one that caught CM's off-by-one) is to compare
a **confirmed** entry's span against a **predicted** one's: they should match
the real-world duration — CM's are uniformly 6 days across both.

## Step 9 — Clean up

Delete the throwaway recon scripts (`scratch_*.py`, `/tmp/*.html`). Don't commit
them. If recon taught you something durable about the source, it belongs in
[data-sources.md](data-sources.md), not in a leftover script.

## Checklist

| # | File | Action | Mirrors |
| - | - | - | - |
| 0 | `scratch_*.py` | Recon both sources; settle key + DOM shape | — |
| 1 | `extractors/<source>/<thing>.py` | Scraper → record dicts (warn-skip) | `gametora/banners.py` |
| 2 | `extractors/<source>/__init__.py` | Facade method | `Gametora.banners()` |
| 3 | `config/yaml/<thing>.yaml` | Curated EN overlay — *optional*, curator-owned, real data | `banners.yaml` |
| 4 | `extractors/static/<thing>.py` | Loader by key pattern (fail-loud) | `config/banners.py` |
| 5 | `extractors/static/__init__.py` | `Static` facade method | `Static.banner_period()` |
| 6 | `models/events/<thing>.py` | Dataclass + collection (`_fetch_primary`/`_enrichers`) | `models/events/banner.py` |
| 7 | `models/events/__init__.py` | Export → auto-discovered stage | — |
| 8 | — | Verify each layer, then full pipeline; check spans | — |
| 9 | — | Delete recon scripts | — |
