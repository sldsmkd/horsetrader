# Idea: As-of-date reprojection — rebuild the prediction as it stood on any day

Status: **exploration** — not committed, no code. Crosscutting: an **ETL capability**
(point-in-time population) consumed by a **reporting model**
([[reporting-model-from-core]]). Developed out of that idea.

## Observation

ETL already **reprojects** — it builds the EN projection from dated JP/EN sources
([[feedback_jp_is_substrate]], [[project_prediction_complete]]). Today it populates
"up to now". But nothing forces *now*: if the inputs are dated, we can populate **up
to an arbitrary cutoff date** and rebuild the timeline artifacts **at the exact state
we'd have drawn the prediction from on that day**.

## Idea

Make the build take an **as-of date** and emit the artifact as it would have existed
then — only the facts known by that date, the predictor chain run over them.

That unlocks **backtesting the predictor**:

- *"What were our predictions in February, under February's assumptions, vs. now?"*
- Run the chain as-of-Feb, as-of-Mar, … as-of-now. Each is a snapshot of what we
  *believed* the EN timeline was on that day.
- **Now's confirmed EN dates are the answer key.** Compare each historical prediction
  against what actually shipped → a measured error curve: how far off were we, and how
  fast did the estimate converge as more JP/EN data landed?

This is a validation/tuning harness for the whole predict chain — exactly the thing
that lets us *trust* (or fix) predictors like `AnniversaryPredictor`'s acceleration
regression, rather than eyeballing them.

## Extension: from backtest to forward confidence (fan charts)

The backtest doesn't just *score* the predictor — it **measures its error
distribution**, and that distribution is exactly the missing ingredient for
*probabilistic* projection.

Today core's economic simulation ([[project_projection_engine]]) produces a **single
deterministic line** — a point estimate of your carat balance over time. But we now
know, empirically, how wrong the underlying date predictions tend to be (and how that
error widens with lead time). So:

1. The backtest yields an **empirical error model** — e.g. "an anniversary date
   predicted 3 months out lands within ±N days, distributed like *this*."
2. Treat that as the **noise on the inputs** to core's sim. Monte-Carlo it: sample
   event dates/amounts from the measured distribution, run the (cheap, headless,
   tested) sim many times, aggregate percentiles.
3. Out comes a **fan chart** — a widening cone of projected balance — and
   **confidence bands**: not "12,400 carats by Aug 1" but "P10–P90 = 11,200–13,500,
   and it tightens as the dates firm up."

The fan **widens with horizon by construction** — exactly matching intuition and the
confidence-in-date rank the predict chain already encodes implicitly
([[y-ordering-importance]] note on the predict chain). The backtest turns that
qualitative rank into a *quantified* spread.

This is the real edge over a spreadsheet ([[project_henry_handsome_prior_art]]): Henry
Handsome gives a point estimate; this gives a **calibrated** one, honest about its own
uncertainty — and the calibration is earned from our own measured track record, not
asserted.

### Notes on the uncertainty model

- **Date uncertainty dominates; amounts are mostly known.** The backtest chiefly
  measures *when* (predicted vs. actual EN dates). Reward *amounts* are largely curated/
  confirmed, so the noise is mostly in timing — when income/affordability lands, not how
  much. Model date noise first; treat amounts as (near-)fixed unless evidence says
  otherwise.
- **Empirical vs. parametric.** Could resample the raw error residuals directly
  (empirical) or fit a distribution per event-type × lead-time (parametric, smoother
  with sparse history). Start empirical; we have few anniversaries, so a fitted curve
  may over-claim precision.
- **It's still a renderer fork.** The fan chart is a *presentation* of the sim output
  (view) and the confidence numbers are a *report* ([[reporting-model-from-core]]) —
  same core, two renderers, same discipline (no stats logic leaking back into core;
  the sim emits the percentiles).

## The load-bearing requirement: "known as of" ≠ the event's own date

The cutoff is **when we learned a fact**, not when the event happens. An anniversary
on 2026-07-20 that was *announced* 2026-06-03 must be invisible to an as-of-May run.
So every input fact needs an **effective/first-seen date**, and we have to source it
honestly or the backtest lies (leaks future knowledge → flatters the predictor).

Candidate provenance sources, roughly in order of fidelity:

- **EN announcement publish date** — the cleanest "when EN truth became known". This is
  *exactly* what the umapyoi news feed carries ([[umapyoi-news-api]]) — the news item's
  timestamp is the moment that EN fact entered the world. Strong synergy: that idea
  supplies the as-of clock for EN facts.
- **JP scrape dates** — when a JP date was first confirmed upstream (Gametora/wikiru).
- **Git history of curated YAML** — `git blame`/commit date on a `config/*.yaml` row is
  when *we* recorded a fact. Cheap, already exists, but tracks our bookkeeping, not the
  world's announcement.
- **Cache fetch timestamps** — coarse, fetch-time not publish-time.

Picking the clock per source class is the core design decision — and the honesty of
the whole exercise rides on it.

## Why it fits horsetrader

- Turns the predictor from "trust me" into "here's its measured track record" — a real
  edge, and the input to tuning.
- Pure leverage of existing machinery: reprojection already happens; this adds a date
  parameter + a provenance clock.
- The comparison output *is* a report ([[reporting-model-from-core]]) — headless,
  diffable, schedulable. The reporting model is how you'd actually read the backtest.

## Design notes / open questions

1. **Where the cutoff applies.** It's a filter on inputs ("drop facts whose effective
   date > cutoff") *before* the chain runs — not a post-hoc mask on outputs. The chain
   must see only the past.

2. **Two distinct comparisons, don't conflate.**
   - *Prediction vs. reality*: as-of-Feb prediction vs. now-confirmed EN truth →
     **accuracy**.
   - *Prediction vs. prediction*: as-of-Feb vs. as-of-Mar → **stability/convergence**
     (how much our belief moved as data arrived), independent of whether either was
     right.

3. **Determinism.** A given (cutoff, source snapshot) must reproduce byte-identically,
   or the backtest isn't a measurement. Watch anything that reads wall-clock `now()` in
   the chain.

4. **Output-shape freedom.** Producing historical artifacts is easy right now —
   output-breaking is allowed ([[project_output_breaking_allowed]]); no need to keep
   old shapes compatible to compare, we re-derive both sides with today's code.

5. **Scope guard.** This spans the ETL↔frontend line ([[project_workspace_split]]): the
   as-of population is ETL, the comparison report is frontend. If pursued, that's two
   single-purpose sessions, not one.

## TODO if pursued

- Decide the per-source provenance clock (lean on the umapyoi news publish date for EN;
  git history for curated rows) and how to attach an effective-date to each fact.
- Add an as-of-date parameter to the build that filters inputs by effective date.
- Audit the chain for wall-clock reads that would break determinism / leak the future.
- Define the two report shapes: accuracy (vs. truth) and convergence (vs. prior runs).
- Derive an empirical date-error model from the backtest (by event-type × lead-time).
- Wire it as input noise to core's economic sim; Monte-Carlo to percentiles (confirm the
  sim is cheap enough headless to run N× — it's tested+headless, so likely yes).
- Define the probabilistic outputs: fan chart (view) + confidence bands (report).
