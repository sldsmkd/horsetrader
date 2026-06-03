# TODO

## ETL — expected by the frontend

Surfaces in [`docs/frontend/ui.md`](docs/frontend/ui.md) need these from the bake.
Frontend is a pure consumer; these are the cross-side pieces still owed by ETL/core.

- [ ] **Procedural stream rates** — the bundle must carry the *numbers* for the
  recurring streams the client expands itself. The dividing line is settled
  ([`contract.md`](docs/contract.md) §"What crosses the wire"): the **client owns a
  procedural stream's cadence; the ETL owns its values** — a game-data literal in
  client code is a smell. The daily-login `SequenceReward` already ships this way;
  still owed are the other recurring streams the old prototype carried —
  **daily-pack subscription, weekly-login, monthly sub** (and any other standard
  recurrence the client generates rather than the ETL enumerating per occurrence).
  Each needs its payout value(s) baked so the client supplies only the cadence +
  user gating, never the `50`. See the procedural-streams ownership table in
  [`docs/frontend/projection.md`](docs/frontend/projection.md) ("Streams are
  independent, composable delta producers").
- [ ] **Baked drop rates** — the plan surface wants an **expected-copies
  distribution** (probability over None / 0LB … MLB for a committed pull count),
  which is deterministic derived math over the commitment **× the game's drop/pity
  rates**. Those rates are game-data, so they must come from the bundle, never a
  client literal. Bake the per-rarity pull rates (and any pity/spark thresholds the
  distribution needs) into a shape the client can read alongside a banner. See
  [`docs/frontend/projection.md`](docs/frontend/projection.md) "Next steps" #3
  (expected-copies distribution) and the plan surface in
  [`docs/frontend/ui.md`](docs/frontend/ui.md).
