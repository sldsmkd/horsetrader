# Idea: Ingest umapyoi's news API as the EN-overlay feed

Status: **exploration** — raw cache fetcher and query service wired, no
overlay/entity semantics committed. ETL / data-source concern.

## Observation

Umapyoi exposes a **news API** that captures the news items off
**umamusume.com** — the official EN site, the literal horse's mouth.

We *could* hit umamusume.com directly, but its news surface is a **weird
infinite-scroll + paginator** — awkward to crawl. Umapyoi already did that
ingestion work and re-serves the items as a clean API — **and each item carries a
direct link to the real umamusume.com content page** (the "Details »" in the
screenshot).

That splits the job cleanly:

- **umapyoi = discovery.** It solves "which news items exist" and the
  infinite-scroll crawl, handing back the index + a link per item.
- **umamusume.com page = content.** Follow the link to the publisher's own page for
  the authoritative payload (full names, exact UTC, rewards, the lot).

So we lean on umapyoi only for the part that's hard (enumeration) and read the
*content* from the primary page directly — we don't have to trust umapyoi's
re-serialized fields for anything load-bearing. Direct enumeration of the official
site stays the (harder) fallback if umapyoi's index ever lags.

Those items carry exactly the fields the EN overlay needs:

- **Official EN name** — "Fuji Kiseki's Showtime Event", "New Legend Races!"
  (canonical, not fansub).
- **Exact EN start, to the hour, in UTC** — `2026/06/03 22:00 (UTC)`.
- An event-type-ish tag ("Game") + a Details link + banner art.

This is the same data we currently transcribe **by human eye** from
[`references/announcements/*.jpg`](../etl/data-sources.md#L16) into the `en:`
blocks of `config/*.yaml`.

## Idea

Wire umapyoi's news endpoint into the transport/extractor layer as a raw cached
discovery surface first, then build toward an **automated EN-overlay feed** once
the payload shape is understood. The raw fetcher is available as
`Umapyoi().news()` for `/api/v1/news` and `Umapyoi().news_item(id)` for
`/api/v1/news/{id}`; `services.News` builds a compact queryable article index
over those leaves. First-party EN truth, fetched rather than hand-keyed:

- Canonical EN **names** → the `en.name` slot ([[project_scenario_name_precedence]]).
- Exact UTC **start** → the `en.start` that also marks an event "shipped to Global".
- Presence of the item *is itself* the "shipped" signal — no more waiting on a human
  to notice the announcement and add the row.

Umapyoi is **already a wired source** ([data-sources.md:89](../etl/data-sources.md#L89)),
so this is an additional endpoint on an existing client path, not a new integration
from zero.

## Two axes — don't collapse them

There are **two independent axes** here, and it's easy to mash them together:

1. **Source authority — primary vs. secondary.** umamusume.com is a **primary
   source**: the publisher itself, the horse's mouth. Gametora / wikiru / umapyoi's
   enrichment endpoints are **secondary** — community databases that re-keyed the
   data. Authority lives in the **content** (umamusume.com), not the carrier — umapyoi
   is just relaying the publisher's items verbatim, not re-interpreting them (unlike
   its enrichment endpoints, which *are* secondary data). So on the EN axis this news
   feed is the **single most authoritative** source we have; it outranks our
   prediction *and* every community scrape for EN facts.
2. **Region role — substrate vs. projection.** Orthogonal to authority.
   [[feedback_jp_is_substrate]]: JP is the substrate you *construct* from; EN is the
   *projected* truth. Being primary does **not** promote EN to substrate — a primary
   EN source is the authoritative **overlay**, not a new build-from input.

Keeping these separate is the whole game: it's a *primary* source (so on EN facts
we **trust it over our own prediction** — a conflict means our projection was wrong,
not a coin-flip) that is *still a projection* (so it stamps EN onto substrate events,
never materialises events itself).

## Critical constraint: authoritative overlay, NOT substrate

The news API is seductive precisely because it's clean, English, dated, *and* primary
— the exact trap [[feedback_jp_is_substrate]] warns about. Authority on the EN axis is
not licence to invert the region model. So:

- The JP scrape (Gametora / wikiru) still **creates** the event and owns the JP
  timeline. The news feed only **stamps the EN projection** onto an event that
  already exists from the substrate.
- An EN news item with **no JP-substrate event behind it** is a *signal* (verify /
  investigate), not licence to materialise an event from the EN side.
- Same stance as today's `references/announcements/*.jpg`: it's the EN-overlay
  source ([[reference_data_sources]]) — we're swapping a manual reader for an API,
  not promoting EN to substrate.

## Design notes / open questions

1. **Join key: how does a news item bind to its substrate event?** The API gives a
   name + date + art, not a stable key. Need a matcher (name normalise + date
   proximity to the predicted EN window) — same shape as the `_ANNI_NAME` join in
   [mission.py](../../horsetrader/timeline/predictors/mission.py). Fuzzy by nature;
   warn-and-skip on no confident match (scraped-input stance).

2. **On drift, the primary source wins.** Because it's primary, a mismatch between
   our predicted `en.start` and the announced one is **our prediction being wrong**,
   not an ambiguous disagreement between equals. The verify path isn't "flag for a
   human to adjudicate" — it's "the authoritative EN date arrived; correct the
   projection." (Contrast a Gametora-vs-wikiru disagreement, where neither is the
   publisher and adjudication *is* needed.)

3. **Verify vs. overlay vs. auto-curate — pick the ambition.** Three rungs:
   - *Verify only*: cross-check our predicted `en.start` against the announced one,
     warn on drift. Lowest risk, immediately useful, no write path.
   - *Overlay*: when an item matches, **fill** `en.name`/`en.start` for events that
     lack a curated EN block — automating the JPG step.
   - *Auto-curate*: write back into `config/*.yaml`. Tension with
     [[feedback_curated_yaml_fails_loud]] / hand-curation discipline — probably a
     bridge too far; the YAML is meant to be human-authored. Lean verify→overlay.

3. **It would have caught the Showtime finale.** The screenshot *is* the final
   フジキセキのショータイム ([[project_showtime_closed_series]], Jun 4–14 2026) — a
   curated closed series we'd otherwise hand-enter. The feed announcing it is the
   trigger to curate, even if we keep the series itself curated.

4. **Trust the content; tolerate the format.** Two different things. The *content* is
   primary/authoritative — don't second-guess what umamusume.com says. But the
   *delivery* (umapyoi's API shape, or the underlying HTML) is still a scraped surface
   that can churn, so parse **defensively**: warn-and-skip on a row that won't parse,
   like Gametora/wikiru ([[feedback_allowlist_drops_are_debug]]). The tolerance is
   about format drift, **not** about doubting the source — distinct from the
   curated-YAML fail-loud stance, and distinct from distrusting a secondary scrape.

5. **Carrier dependency shrinks to discovery only.** Because we follow umapyoi's link
   and read *content* from the primary page, the one thing we trust umapyoi for is
   **enumeration** — that its index surfaces every news item promptly (no missed/lagged
   entries). Field-level fidelity doesn't matter; we don't read load-bearing payload
   from umapyoi. Acceptable trade: the alternative is crawling the official site's
   infinite-scroll ourselves, which is exactly the work umapyoi saved. Keep direct
   enumeration documented as the fallback if umapyoi's index ever goes stale, but don't
   build it pre-emptively.

6. **Coverage / cadence.** What's the API's retention + shape — does it page back far
   enough to backfill, or only show the live news window? TTL it like the other
   umapyoi/index pulls.

## Why it fits horsetrader

- Removes the single most manual step in the ETL (eyeballing announcement JPGs) and
  replaces it with first-party data — without touching the substrate model.
- Tightens the EN projection's accuracy (exact UTC to the hour, official names) and
  the "shipped" signal, feeding the contract the site consumes ([../contract.md](../contract.md)).

## TODO if pursued

- Characterise **both** surfaces: (a) umapyoi's news index — URL, item shape, the
  content link field, pagination/retention, rate/TTL; (b) the umamusume.com content
  page the link points at — its payload shape and which fields are reliably present.
- Decide the rung (verify → overlay → auto-curate) and the join/matcher.
- Add to the source table in [data-sources.md](../etl/data-sources.md) as an EN-overlay
  feed, explicitly tagged *not substrate*.
- Confirm it stamps existing substrate events only — guard against EN-side event
  materialisation.
