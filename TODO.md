# TODO

## ETL — expected by the frontend

Surfaces in [`docs/frontend/ui.md`](docs/frontend/ui.md) need these from the bake.
Frontend is a pure consumer; these are the cross-side pieces still owed by ETL/core.

- [ ] **Search** — searchable atom catalogue + aliases for the typeahead (every
  trainee + support, all alt-versions, game-grammar names + community nicknames).
  Alias data is authored in
  [`docs/references/import/search_aliases.yaml`](docs/references/import/search_aliases.yaml)
  (old prototype, **not yet reintegrated**); reintegrate + bake an atom-granularity
  searchable index into the bundle.
- [ ] **Free pulls** — per-banner gift-pull count, baked on (the prototype baked it
  as `gift_pulls`). Authored in
  [`docs/references/import/free_pulls.yaml`](docs/references/import/free_pulls.yaml)
  (old prototype, **not yet reintegrated**); reintegrate so the frontend can consume
  the field (feeds the banner resource readout's gift stream + the value highlight).
- [ ] **Rushable** — per-event `rushable` flag (ETL marks which events can be rushed)
  **plus core** modelling the rushed state (post at start instead of last-day, at an
  efficiency penalty). The genuine modelling lift of the three; data cost is nil (a
  bool on the ~1000-row event corpus). Feeds the rushable-events toggle.
