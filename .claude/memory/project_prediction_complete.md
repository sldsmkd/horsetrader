---
name: project_prediction_complete
description: Prediction subsystem is feature-complete as of 2026-05-30; remaining ETL frontier is data sources.
metadata: 
  node_type: memory
  type: project
  originSessionId: 3bc35e7e-f3e2-452d-86b5-7656afc03111
---

As of 2026-05-30 the user considers the prediction subsystem
(`horsetrader/timeline/`, owned by `@matikanefukukitaru`) fully implemented.
The predictor chain is closed end-to-end: Anniversary → Holiday → Scenario →
Story → Banner → Anchor → Fallthrough, so no event with a JP period lands in
`unpredicted` anymore.

`BannerPredictor` has four passes: anchor-snap, story tie-in, bracket
interpolation (JP spacing scaled into the EN window between two scheduled
neighbours), and tail extrapolation (off the global `acceleration(JST, UTC)`
slope). `DateMapper` is a bidirectional piecewise-linear day map;
`FallthroughPredictor` runs dead-last, builds a DateMapper from everything
scheduled, maps any leftover event, and logs a per-event WARNING so the user
can decide to add a dedicated pass or accept the generic behaviour. See
`docs/prediction.md` for the full writeup.

Remaining work on the ETL side is **data sources**, not prediction.
