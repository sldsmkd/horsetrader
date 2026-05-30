# Prediction

How the ETL fills in missing Global (EN) dates for events that exist on JP
but haven't been announced for EN yet. Owned end-to-end by
`@matikanefukukitaru` ([`horsetrader/timeline/predictors/`](../horsetrader/timeline/predictors/)).

## The shape

Every `Event` carries a `Periods` collection — at most one `Period` per
`tzinfo`. Extraction stamps:

- a **JP `Period`** for the event's JP run, and
- a **UTC `Period`** for events whose EN release has already happened or
  been announced (sourced from the `en:` blocks in `static/yaml/banners.yaml`,
  `anniversaries.yaml`, `scenarios.yaml`, `stories.yaml`, and
  `holidays.yaml`).

`Predict.predict(timeline)` runs an ordered chain of predictors. Each
predictor walks the timeline, looks for events that need a UTC `Period`
under its remit, computes one, and appends `Period(start=…, predicted=True)`.
After the chain runs, `Predict` constructs a new `Timeline` containing
only events that now carry a UTC period and returns it.

The `predicted` flag on the matched `Period` is what `Bake.events()` uses
to tag the output — it's not a field on the `Banner` / `Scenario` itself.

## Vibes, not statistics

This is heuristics over the in-memory timeline, not a fitted model:

- No corpus assembly, no kernel weighting, no regression beyond a single slope.
- The quantitative inputs are three helpers on `Timeline`
  ([`timeline.py`](../horsetrader/timeline/timeline.py)):
  - `origin(tz)` — earliest non-predicted event start in `tz`, treated as
    that server's launch anchor.
  - `acceleration(from_tz, to_tz)` — least-squares slope of
    `to_elapsed ≈ slope · from_elapsed` through the origin, with elapsed
    measured from each tz's `origin()`. Fitted across every event carrying
    non-predicted periods in both zones; predicted periods excluded.
  - `predict(dt, to_tz)` — convenience composition:
    `origin(to_tz) + acceleration · (dt - origin(dt.tzinfo))`.
- Everything else is "match-by-shape" — same JP date, snap to the nearest
  weekday EN has used historically, lean on the latest co-released
  scenario, match a banner's casts against the nearest story's casts, etc.

If at any point the heuristics start mis-predicting in systematic ways,
the next step is a proper regression — but Mati only switches techniques
when the vibes stop working.

## The chain

Ordering matters: most authoritative first, fill-in last. Each predictor
in turn sees the mutations the previous one made, so a later predictor
can use an earlier one's `predicted=True` periods as if they were
confirmed for routing purposes.

### `AnniversaryPredictor`

Predicts EN dates for anchors of kind `anniversary` (`Anchor` instances whose
key is `anchor-anni-…`) with no confirmed UTC period.

1. Collect confirmed JP+UTC pairs from those anchors. If none exist, return 0.
2. Build a **weekday signal** from those same confirmed pairs.
3. Compute the global `Timeline.acceleration(JST, UTC)` slope. If it can't
   fit, return 0.
4. For each unscheduled anniversary: project through the acceleration and
   snap to the nearest valid weekday at 22:00 UTC, `predicted=True`.

### `HolidayPredictor`

Covers anchors of kind `golden-week` and `new-year` — the two holiday
flavours of the collapsed `Anchor` type. Anniversaries are anchors too but
predict on their own cadence via `AnniversaryPredictor`; this predictor
filters on `Anchor.kind`, not the runtime class.

Weekday signal is merged across both flavours (any weekday with a confirmed
EN drop counts as valid). For each unscheduled holiday, project its JP
start via `Timeline.predict(jp_start, UTC)`, snap to the nearest valid
weekday, and stamp `Period(start=<snapped at 22:00 UTC>, predicted=True)`.
If the regression can't fit (< 2 correlated pairs anywhere on the timeline)
the predictor returns however many it managed before the fit failed.

### `ScenarioPredictor`

Predicts EN dates for scenarios with no confirmed UTC period.

1. **Anniversary lock-in (pass 0):** build a JP-date → EN-period map from
   all anchors of kind `anniversary` that already carry a UTC period
   (confirmed or just predicted by `AnniversaryPredictor`). If a scenario's JP date
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

### `StoryPredictor`

Confirmed story EN dates come from
[`static/yaml/stories.yaml`](../static/yaml/stories.yaml) at enrichment time
(see `Stories._enrichers` in [`models/events/story.py`](../horsetrader/models/events/story.py));
the same yaml also carries an optional `en.name:` override for the EN
title, applied alongside the period.
The predictor fills the rest in two passes.

Pass 1 (anchor snap): same shape as `BannerPredictor` pass 1. If a JP
story shares a JP drop date with an `Anchor` (any kind — new year, golden
week, anniversary) or a `Scenario` whose EN date is known (confirmed or
predicted upstream), snap the story to that EN date at 22:00 UTC.

Pass 2 (ordinal interpolation): for the remaining unscheduled stories,
walk the stable-key-sorted list, bisect between the two nearest scheduled
neighbours, and place each unscheduled story at the matching JP-time
fraction of the EN window:

```
frac = (jp - left_jp) / (right_jp - left_jp)
rough_en = left_en + frac · (right_en - left_en)
```

The result is snapped to the weekday distribution of confirmed EN stories
(any weekday with > 0 confirmed drops — naturally excludes Fri/Sat since
the JP-side dev team treats Friday GMT (= Saturday JST) as outside working
hours), then stamped at 22:00 UTC. Stories with no left or right
bracketing neighbour are left alone — extrapolation is `BannerPredictor`'s
problem, not Story's.

### `BannerPredictor`

Pass 1 (anchor snap): if a JP banner co-released with an `Anchor` (any kind)
or a `Scenario`, snap the banner's EN start to that event's EN date —
confirmed or already predicted by an earlier predictor. Anchor types are
tried in `_ANCHOR_TYPES` order (`Anchor`, then `Scenario`); the scenario
anchor wins if both share a JP date. The banner's JP `span` carries over; the
start is 22:00 UTC on the anchor's EN date.

Pass 2 (story tie-in): banners that don't share a JP date with an anchor
event are often promotional banners for a story — e.g. Halloween costume
banners drop alongside the Halloween story. For each remaining
unscheduled banner with non-empty `contents`, scan stories whose JP start
is within ±7 days, and if any story's `trainees` and `supports` are a
superset of the banner's trainee and support contents (matched by stable
key), snap the banner to that story's EN date at 22:00 UTC. First match
wins. This catches roughly half the otherwise-orphaned banners — see the
`_predict` stats for the running tally.

Pass 3 (spacing interpolation): the remainder are marketing-driven orphans
(typically standalone SR/SSR support promos between story windows) with no
anchor co-release and no story cast match — but they still sit *between*
banners passes 1/2 just scheduled. Banners live on a JST timeline, so JP
order is chronological; for each orphan, bisect between its two nearest
scheduled banners (confirmed or predicted upstream) and place it at the same
fraction of the EN window it occupies in the JP window:

```
frac = (jp - left_jp) / (right_jp - left_jp)
rough_en = left_en + frac · (right_en - left_en)
```

That carries the JP spacing across, scaled into UTC. The result is snapped
to the confirmed EN weekday distribution and stamped at 22:00 UTC. Same
shape as `StoryPredictor`'s interpolation pass — including the non-monotonic
bracket guard (skip + warn if `right_en <= left_en`) and the weekday-snap
drift caveat. Brackets are the pre-pass-3 anchors only; freshly interpolated
banners don't become anchors for their neighbours, so error doesn't compound.
The timeline's head is always bracketed (the back-catalogue is fully
anchored); the unbracketed tail is pass 4's job.

Pass 4 (tail extrapolation): the most recent JP banners sit past the last
scheduled banner, so they have no right neighbour for pass 3 to bracket
against. Anchor on the latest scheduled banner (confirmed or predicted) and
project each remaining orphan forward along the `Timeline.acceleration(JST,
UTC)` slope:

```
rough_en = anchor_en + slope · (jp - anchor_jp)
```

A straight line off the last known point — no right anchor needed.
Weekday-snapped and stamped at 22:00 UTC like the other passes. Lower
confidence than bracketed interpolation (it leans entirely on the global
slope), but the tail has no closer signal. Anything at or before the anchor
is skipped — that's a pass-3 concern, not an extrapolation. With pass 4 in
place no banner carrying a JP period is left unpredicted.

### `ChampionsMeetingPredictor`

Runs after `BannerPredictor`, before `AnchorPredictor` / the fallthrough. CMs
need their own pass because their two sources disagree on span *by design*:
Gametora records only competitive play, so the JP scrape is always exactly 6
days, while the EN release is the full availability window (usually 10) that
adds the lead-in on the front (see [domain.md](domain.md)). The generic
fallthrough would carry the fixed 6-day JP span across and map the JP *opening*
day — wrong on both.

Instead this **anchors on the final day**, which is precomputed and meta-immune
(the opening drifts under the Oguri Cap rule). It builds a
[`DateMapper`](../horsetrader/timeline/datemapper.py) from confirmed CM pairs
keyed JP-final → EN-final, maps each unscheduled CM's JP final through it, and
rebuilds the EN window *backwards* from that final using the mean confirmed EN
span — stamped at 22:00 UTC. Final-to-final also absorbs the asymmetric
front-padding (EN includes pre-registration days the JP scrape omits). Needs ≥2
confirmed CMs to interpolate; with fewer it stamps nothing and leaves them to
the fallthrough.

### `FallthroughPredictor`

Dead last in the chain — after every dedicated pass, including
`AnchorPredictor`. Builds a [`DateMapper`](../horsetrader/timeline/datemapper.py)
from every event already carrying both a JP and a UTC period (confirmed or
predicted upstream), then maps the JP day of anything *still* missing a UTC
period through it and stamps `Period(predicted=True)` at 22:00 UTC.

It's the catch-all bucket — cross-type by design (the JST→UTC server warp is
shared, so a stray story can ride banner/scenario anchors and vice versa),
no weekday snap, no per-type signal. `DateMapper` does a bisect to the
bracketing pairs, linear-interpolates, and rounds to the nearest whole day;
outside the known range it extrapolates off the nearest end segment's local
slope (deliberately janky past the last anchor — fine for a last resort). The
more the passes above schedule, the more local slopes it has to work against,
so its accuracy rises as the timeline fills in. Today it's inert
(`fallthrough: 0` — nothing reaches it), but it's there to keep new event
types or edge cases from silently landing in `unpredicted`.

## Stats

Each predictor returns the count of new predictions it made. `Predict`
collects them keyed by lowercased class name without the `Predictor`
suffix, plus an `unpredicted` tally for events that still lack a UTC
period after the chain:

```json
"_predict": {
  "anniversary": 8,
  "holiday": 8,
  "scenario": 10,
  "story": 39,
  "banner": 254,
  "anchor": 3,
  "fallthrough": 0,
  "unpredicted": 0
}
```

`unpredicted` is currently 0: passes 1–3 cover anchored, story-tied and
bracketed banners, and pass 4 extrapolates the tail. A non-zero value isn't
a failure — it just means some event carries a JP period the chain couldn't
route (e.g. a banner with no JP period at all, or a future event type with
no predictor) — but banners no longer contribute to it.

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

### Cross-predictor anchor unification

`AnniversaryPredictor` and `ScenarioPredictor` still compute their own
JP/UTC anchors locally from confirmed pairs (`min(p[0] for p in confirmed)`),
while `HolidayPredictor` uses `Timeline.predict()` which goes through
`Timeline.origin()`. Functionally close — the global origin is usually the
earliest event in either tz regardless — but the two approaches can drift
if a tz has an event with no correlated counterpart that's earlier than
any correlated pair. Unify when convenient.

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
