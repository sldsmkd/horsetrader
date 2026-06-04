# Idea: A reporting model built from core (the UI isn't core's only consumer)

Status: **exploration** — not committed, no code. Frontend (`horsetrader.site`) concern.

## Observation

The frontend **core** — the timeline + projection engine — is **pure, fully under
test, and runs headless**. Nothing about it needs a browser or a view: it's account
facts and a projection over them ([[feedback_projection_is_account_not_view]],
[[project_projection_engine]]).

That means **the UI is only one consumer of core, not the point of core.** The same
engine that the view renders into pixels can drive an entirely non-visual output.

## Idea

Build a **reporting model** as a second consumer of core, parallel to the UI:

```
                ┌─ ui/        → pixels (the timeline view)
core (headless) ┤
                └─ reporting/ → text / data (summaries, exports)
```

Core stays the single source of computed truth; rendering forks into "view" and
"report". A report is just a different *projection of the projection* — e.g.:

- A plain-text / Markdown summary: "by 2026-08-01 you'll hold ~12,400 carats; the
  1.5th Anniversary banner is affordable, the following one is not."
- A structured export (JSON/CSV) of the ledger / projected balance over time.
- Milestone callouts: when each saved-for target becomes affordable.

Because core is headless+tested, a report can be generated in **CI, a cron job, a CLI,
or server-side** — no browser, no manual screenshotting.

## Why it fits horsetrader

- **Leverages work already done.** Core's headless+tested property is the enabler;
  this just adds a renderer that reads the same outputs the view does.
- **Reinforces the seam the design already draws.** Presentation lives outside core
  ([[feedback_projection_is_account_not_view]]); a report is presentation too, just a
  textual one. It validates that the core/view split was real and not UI-coupled.
- **"Edge over a spreadsheet," in a shareable form.** The planner's value as prose/
  export — something you can paste, diff, or schedule — without opening the app.

## Design notes / open questions

1. **Reporting is a renderer, not core.** Same discipline as the UI: a report reads
   core's outputs and presents them; it must not pull account/presentation logic back
   *into* core. If a report needs a number core doesn't expose, the fix is core
   exposing the fact, not the reporter computing it.

2. **What's the first report worth building?** The cheapest high-value one is probably
   the affordability/milestone summary (it's the planner's whole thesis in one
   paragraph). Pick one concrete report before generalising a "reporting framework."
   A flagship candidate that grew out of this idea: the **prediction backtest**
   ([[as-of-date-reprojection]]) — rebuild the timeline as-of past dates and report how
   the prediction tracked reality.

3. **Where does it run, and what triggers it?** Headless means options: a CLI you run
   locally, a step in the build, or a scheduled job. Decide the host before the format
   — a CI artifact and a CLI dump want different shapes.

4. **Account input.** A report still needs *an account* to project from (tier, login
   cadence, targets). Where that comes from headlessly (a config file? the same
   persisted account config the UI uses?) is the one input the view gets from the user
   that a headless reporter must source another way.

## TODO if pursued

- Confirm core's public outputs are renderer-agnostic enough to drive a non-DOM
  consumer (no hidden view coupling).
- Pick the first concrete report + its host (CLI vs CI vs cron) + format.
- Decide how a headless run sources the account config.
