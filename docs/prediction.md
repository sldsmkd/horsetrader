# Prediction

How the ETL fills in missing Global (EN) dates for events that exist on JP
but haven't been announced for EN yet. Owned end-to-end by
`@matikanefukukitaru` ([`horsetrader/timeline/predictors/`](../horsetrader/timeline/predictors/)).

## The shape

Every `Event` carries a `Periods` collection — at most one `Period` per
`tzinfo`. Extraction stamps:

- a **JP `Period`** for the event's JP run, and
- a **UTC `Period`** for events whose EN release has already happened or
  been announced (sourced from `static/en.banners.yaml`).

`Predict.predict(timeline)` runs an ordered chain of predictors. Each
predictor walks the timeline, looks for events that need a UTC `Period`
under its remit, computes one, and appends `Period(start=…, predicted=True)`.
After the chain runs, `Predict` constructs a new `Timeline` containing
only events that now carry a UTC period and returns it.

The `predicted` flag on the matched `Period` is what `Bake.events()` uses
to tag the output — it's not a field on the `Banner` / `Scenario` itself.

## Vibes, not statistics

This is heuristics over the in-memory timeline, not a fitted model:

- No corpus assembly, no kernel weighting, no regression.
- The single quantitative input is
  [`Timeline.acceleration(from_tz, to_tz)`](../horsetrader/timeline/timeline.py) —
  a least-squares slope of `to_elapsed ≈ slope · from_elapsed` through the
  origin, fitted across all events carrying confirmed periods in both
  zones. Predicted periods are excluded.
- Everything else is "match-by-shape" — same JP date, snap to the nearest
  weekday EN has used historically, lean on the latest co-released
  scenario, etc.

If at any point the heuristics start mis-predicting in systematic ways,
the next step is a proper regression — but Mati only switches techniques
when the vibes stop working.

## The chain

Ordering matters: most authoritative first, fill-in last. Each predictor
in turn sees the mutations the previous one made, so a later predictor
can use an earlier one's `predicted=True` periods as if they were
confirmed for routing purposes.

### `AnniversaryPredictor`

Predicts EN dates for `Anniversary` events with no confirmed UTC period.

1. Collect confirmed JP+UTC pairs from `Anniversary` events. If none exist, return 0.
2. Build a **weekday signal** from those same confirmed pairs.
3. Compute the global `Timeline.acceleration(JST, UTC)` slope. If it can't
   fit, return 0.
4. For each unscheduled anniversary: project through the acceleration and
   snap to the nearest valid weekday at 22:00 UTC, `predicted=True`.

### `HolidayPredictor`

Covers `GoldenWeek` and `NewYear` specifically — the two concrete subtypes
of `Holiday`. Base `Holiday` is not targeted directly.

Same acceleration + weekday-snap structure as `AnniversaryPredictor`, with
the weekday signal merged across both subtypes. Confirmed JP+UTC pairs are
drawn from `GoldenWeek` and `NewYear` events only.

### `ScenarioPredictor`

Predicts EN dates for scenarios with no confirmed UTC period.

1. **Anniversary lock-in (pass 0):** build a JP-date → EN-period map from
   all `Anniversary` events that already carry a UTC period (confirmed or
   just predicted by `AnniversaryPredictor`). If a scenario's JP date
   exactly matches an anniversary's JP date, snap the scenario to that
   anniversary's EN date and skip the acceleration model for that event.
2. Build a **weekday signal**: histogram of weekdays from confirmed-EN
   scenario releases, kept as the set of weekdays with count > 0.
   Monthday is *not* used (under compressed acceleration, day-of-month
   isn't a stable signal).
3. Compute the global `Timeline.acceleration(JST, UTC)` slope from all
   confirmed pairs across the timeline. `JST` and `UTC` anchors are the
   earliest start in each zone.
4. For each remaining unscheduled scenario:
   - Project its JP start through the acceleration: `rough = utc_anchor + slope * jp_elapsed`.
   - Snap `rough` to the nearest valid weekday via
     [`nearest_weekday`](../horsetrader/timeline/predictors/base.py).
   - Stamp the result as a `Period(start=<snapped at 22:00 UTC>, predicted=True)`.

If no confirmed scenarios exist in the timeline, or `acceleration()`
can't fit (< 2 correlated pairs), the predictor returns 0 — Mati doesn't
extrapolate from nothing.

### `BannerPredictor`

Pass 1 (live): if a JP banner co-released with any of `Anniversary`,
`GoldenWeek`, `NewYear`, or `Scenario`, snap the banner's EN start to that
event's EN date — confirmed or already predicted by an earlier predictor.
Anchor types are tried in dict-lookup order; the scenario anchor wins if
multiple types share a JP date. The banner's JP `span` carries over; the
start is 22:00 UTC on the anchor's EN date.

Pass 2 (planned, not implemented): general banner acceleration for
banners that *don't* co-release with any anchor event. Currently those slip
through and stay unpredicted, surfacing in `metrics["_predict"]["unpredicted"]`.

## Stats

Each predictor returns the count of new predictions it made. `Predict`
collects them keyed by lowercased class name without the `Predictor`
suffix, plus an `unpredicted` tally for events that still lack a UTC
period after the chain:

```json
"_predict": {
  "anniversary": 8,
  "holiday": 3,
  "scenario": 3,
  "banner": 24,
  "unpredicted": 214
}
```

`unpredicted > 0` is informational, not a failure — it usually means
non-scenario banners that need pass-2 acceleration, or scenarios with no
JP-side anchor history.

## Deferred / future work

### Outlier rules hook (planned)

Some EN scheduling decisions don't follow from the JP slope alone. The
canonical example: when a JP banner ran during a Champions Meeting, the
EN release gets pushed back to avoid overlap with the EN CM. See
[domain.md](domain.md) for the policy and the Christmas Oguri incident
that's its genesis.

The intended shape is a **post-processing hook** layered on top of the
regression: a list of rule functions that adjust predicted dates after
the predictor chain runs. Rules are individual, named, and toggleable
— don't bake them into the predictors themselves, and don't pre-implement
any until the user formalises one.

### BannerPredictor pass 2 (planned)

General acceleration-based projection for banners with no co-release
anchor at all (not scenario, anniversary, or holiday). Will likely mirror
`ScenarioPredictor` but using a banner-specific weekday signal. 214 banners
currently slip through here.

### Story ingest pipeline (planned)

Stories always bundle thematic costume variants (e.g. Halloween story →
Halloween trainee). Once `Story` events are ingested, `Story` can be added
to `BannerPredictor._ANCHOR_TYPES` and story EN dates will anchor the
matching costume banner predictions.

### Confidence intervals

Not implemented. `Period.predicted` is binary. If we ever want soft
confidence (e.g. "this date ±3 days"), it'd live on `Period` as an
optional uncertainty span — but defer until a consumer actually wants it.

## When to add a new predictor

A predictor is the right home when:

- The event type has its own scheduling rhythm (CMs are a candidate
  if/when they need predicted dates),
- The signal differs from the existing predictors (CM scheduling
  appears fully automated — Fri/Sat heavy, some Tuesdays — so it
  wouldn't share the scenario weekday signal), **and**
- The prediction can be expressed as "look at the timeline, append a
  `Period(predicted=True)` to the relevant events."

Place new predictors in `horsetrader/timeline/predictors/<thing>.py`,
subclass `Predictor`, decorate `@matikanefukukitaru`, and slot into the
chain in [`Predict.predict`](../horsetrader/timeline/predict.py). Order
is significant — earlier predictors' outputs are visible to later ones.
