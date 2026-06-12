# Eclipse — Overview

_Frontend rearchitecture. Wooly by design; keep it to one screen._

## Why (the itch)
- Big bang: modelled ~90% of income/spend streams while wiring the income model — largely successful.
- Picked up patterns along the way; now time to solidify them and bring everything into line.

## Goals
- Audit every source/stream and establish clear, consistent namespacing with explicit rules.
- A registry: one declaration shape, fully adopted everywhere — no exceptions.
- Retrofit the pattern we arrived at late onto the streams we built early (when we shoved things into the most convenient hole).
- Whole economic model runs headless (no UI dep): testable end-to-end, and other clients become possible (e.g. CLI report/forecast). Web app is just one client.

## Non-goals
- Frontend-pure: no ETL/bake changes, no touching the etl↔site contract. Consume the bake as-is.

## Way of working
- Design in Python (thinking language), land in TS. Scaffold a Python mock of the existing system + its (stubbed) prediction-engine interaction to feel the shape and define the API.
- The Python fixture is disposable exploration — it shapes the contract, it doesn't define it. The contract lands in TS.
- Test against a frozen JP-timeline moment (~3rd anniversary). The past is immutable, so a sudden test break signals the ETL enriched/changed something, not an engine regression.

## Anecdotes / notes
- The good pattern came late, not from the start — early streams predate it and never got brought up to it.
- A stream specific to a class of thing owns its own business logic — the registry entry is where that logic lives, not just a label.
- Stream control surface = enabled/disabled (the config sliders) + optional scale the stream owns. Frontend says "be sweetie"; the stream reaches into config and decides what sweetie-vs-sweaty means for it.
