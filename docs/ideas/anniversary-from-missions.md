# Idea: Derive anniversaries from their missions (drop the curated YAML)

Status: **exploration** — not committed, no code. ETL / prediction-chain concern.
Direct sequel to issue #18 (anniversary missions ↔ anchors).

> Note on terms: **`Anchor`** is the code construct (the event class). This idea is
> *not* about renaming or re-parenting anchors — it's about **removing the curated
> `anchor-anni-*` YAML** and letting the scraped mission be the derivation point.

## Observation

The anniversary celebration mission sets are **strongly correlated** with the
anniversary beat — and some are *literally named* it (`周年`/`アニバ`/"X.5th
Anniversary", e.g. `mission-00217`/`00218`, *1.5th Anniversary 記念ミッション 第1弾/
第2弾*). The correlation isn't incidental; the mission *is* the anniversary's
on-the-ground footprint — and it's **already scraped**, dated, and self-naming.

## Idea

**Use the mission as the derivation point, removing the hand-curated YAML.**

Today the anniversary's existence and dates are hand-entered:

- The `anchor-anni-N_M` records are **curated YAML** — JP start always, EN start
  once shipped — loaded by
  [anniversaries.py](../../horsetrader/extractors/static/anniversaries.py); EN is
  otherwise derived by the JST→UTC acceleration regression in
  [anniversary.py](../../horsetrader/timeline/predictors/anniversary.py).
- [`MissionPredictor`](../../horsetrader/timeline/predictors/mission.py) then pins
  the anniversary mission *to* that curated anchor (nearest by date, name-validated,
  preserving the mission's JP offset).

Since the mission already carries the real scraped JP/EN dates and names itself an
anniversary, that curated YAML is **redundant input** — the anniversary's date can be
read straight off the mission. Drop the `anchor-anni-*` YAML and derive the beat from
the scraped mission instead of hand-maintaining it.

## Why this is attractive

- **Removes hand-maintained input.** No more curating an `anchor-anni-*` row per
  anniversary — the scraped mission already states it. Less YAML to keep in sync, one
  fewer place to forget when a new anniversary lands.
- **Grounds the beat in observed data, not a model.** `AnniversaryPredictor` infers
  the EN date from an acceleration slope + weekday-snap — a derived estimate. The
  named mission carries a *real* scraped date. Trust the scrape over the regression
  when the scrape exists.
- **Resolves #18 from the other end.** #18 worries the curated anchor and the mission
  set *duplicate* one beat. Removing the YAML collapses the duplication to its single
  reliable source — the scraped mission — instead of reconciling two.

## Design notes / open questions

1. **What does the YAML carry that the mission must now supply?** Before deleting it,
   inventory the `anchor-anni-*` record: JP launch moment, EN start, canonical name,
   and (per #18) possibly a curated reward haul. The mission gives dates + a name; if
   the curated record also encodes the **anniversary login/present reward stream**,
   that part is *not* in the mission and can't just be dropped. The clean version of
   this idea is "drop the YAML **iff** everything it holds is derivable from the
   mission (or lives elsewhere)." If rewards are entangled, this becomes "drop the
   *date* curation, keep a slimmer reward record" — settle alongside #18.

2. **Confidence-in-the-date rank / chain order.** A named, dated anniversary mission is
   plausibly a *higher-confidence* EN signal than the acceleration regression (same
   scalar [[y-ordering-importance]] note 1 gestured at). So the mission-derived beat
   should sit **earlier** in the chain than `AnniversaryPredictor`. Today
   `MissionPredictor` runs *after* and depends on the curated anchor; removing the
   YAML inverts that dependency.

3. **Coverage / fallback.** Not every anniversary has a cleanly-named scraped mission
   at predict time (future beats, missing scrape). The regression path stays as the
   fallback — this is "derive from the mission *when it exists*," not "delete the
   predictor."

4. **Name match is the validation, date is the link — same as today.** The existing
   `_ANNI_NAME` regex + bounded-distance match ([mission.py:19-20](../../horsetrader/timeline/predictors/mission.py#L19))
   is exactly the join we'd reuse; we'd just run it to *materialise the anniversary*
   from the mission instead of to *place the mission* against curated YAML.

## Why it fits horsetrader

- Leans on [[feedback_jp_is_substrate]] and the data-source hierarchy
  ([[reference_data_sources]]): scraped JP/EN reality (Gametora mission windows)
  outranks a derived model. Flip puts the more-substrate signal in charge.
- Additive to the chain; no output-shape change required (and output-breaking is
  allowed anyway, [[project_output_breaking_allowed]]).

## TODO if pursued

- Inventory the `anchor-anni-*` YAML record field-by-field: which fields the scraped
  mission can supply vs. which (esp. reward stream) would be orphaned by deleting it.
- Confirm anniversary missions reliably carry a scraped **EN** date (not just JP) at
  predict time — the derivation only pays off if the mission's EN window is observed,
  not itself predicted.
- Decide chain order: where a "mission-materialises-anniversary" pass sits relative to
  `AnniversaryPredictor` (the regression fallback).
- Reconcile with #18: single decision on (date source) + (reward boundary) together.
