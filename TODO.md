# TODO

## ETL — expected by the frontend

Surfaces in [`docs/frontend/ui.md`](docs/frontend/ui.md) need these from the bake.
Frontend is a pure consumer; these are the cross-side pieces still owed by ETL/core.

- [x] **Search** — done. Aliases are the only non-derivable piece (the frontend
  builds the catalogue + game-grammar labels itself from the academy records),
  so the bake folds community phrases onto each atom: `TraineeRecord` /
  `SupportRecord` now carry `aliases: list[str]` (always present, often `[]`).
  Authored in [`config/yaml/search_aliases.yaml`](config/yaml/search_aliases.yaml)
  as `alias-<body>: {target, phrases}` entries (own namespace + a `target`
  stable key, mirroring anchored events' `anchor:`); a `char-` target folds onto
  every one of that character's atoms, `trainee-`/`support-` onto one card.
  Loaded via [`extractors/static/aliases.py`](horsetrader/extractors/static/aliases.py)
  and **enriched onto the entity models** during load (Digitan, through the
  pipeline) — `Character`/`Trainee`/`Support` carry `aliases`; each collection
  fail-loud validates its own namespace's targets via the new
  `TracenModels._validate_collection` hook. The bake just reads model fields and
  unions character + card phrases (no source-data side-load in `output/`).
- [x] **Free pulls** — done. Modelled as a `Pull` counter reward (Yayoi domain,
  key `pulls`, no backing item — a granted pull is always free, so no "free"
  qualifier), so it bakes into the banner's existing `rewards` object
  (`{"pulls": N}`, alongside any carats) rather than a bespoke top-level field —
  the prototype's `gift_pulls` renamed to match the source. Authored inside each
  `banner-<id>` corpus entry's `rewards:` block (`rewards: {pulls: N}`) — the
  same baked-shape vocabulary every other curated event uses, so it folds in via
  the shared `rewards_from_baked` with no pulls-specific path. Folded onto banner
  root keys in [`config/yaml/banners.yaml`](config/yaml/banners.yaml), not a
  standalone file; future banners with a known count but no confirmed EN date
  carry a `rewards`-only entry (the period loader skips entries with no `en:`
  block). Read by [`extractors/static/banners.py`](horsetrader/extractors/static/banners.py)
  `load_rewards()`, stamped in `Banners._fetch_primary` (fail-loud parse,
  alongside the computed first-original carats); `Banners._validate_collection`
  fails loud on a curated reward block whose banner has no model. Maintainer can
  relocate any entry near a related event (e.g. 30151 → Grand Live) — store
  location is cosmetic.
- [x] **Rushable** (ETL side) — done. Modelled as a light `RushableEvent(Event)`
  subclass carrying a `rushable: bool` (default `True`) + a `RushableEventRecord`
  envelope adding the baked key; `Banner` and `Story` extend them (the documented
  rushable-capable types). So the `rushable` key lands **only** on banner/story
  records — never on anchors/CMs/scenarios, which can't be rushed — and the
  capability is a type-level fact rather than a flag on every event. A member
  that shouldn't be rushable can set `rushable=False`. **Still owed by core/site:**
  the rushed-state *modelling* (start-post + efficiency penalty) is the client's
  projection job (see docs/frontend/projection.md + ui.md rushable-events).
