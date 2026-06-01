# Architecture

What runs in what order, where data crosses boundaries, and the invariants
the pipeline relies on. Pair this with [semantics.md](semantics.md) for the
character-name overlay and with [prediction.md](prediction.md) for the
predictor chain in detail.

## One-paragraph version

`Pipeline()` is a lazy singleton. First access triggers eager construction
of every `TracenModels` collection registered in the `models/` tree —
characters, supports, trainees, banners, scenarios, … — each of which
scrapes its inputs via `UmaClient` and assembles its own dependency-ordered
load. Confirmed EN dates are stamped onto events as a UTC `Period` during
extraction (Transcend's job — the EN corpus isn't a separate stage).
`Pipeline.run()` then builds a **timeline** of every Event, hands it to
`Predict`, which fills in predicted UTC periods for the ones missing them,
and passes the resulting **UTC-bearing timeline** to `Bake`, which writes
`academy.json` and `events.json` into the repo-root `static/json/` deploy dir,
and each one's JSON Schema into `config/schema/` (the contract, kept out of the
shippable `static/` tree).

## Stages

```
                              ┌─────────────────────┐
                              │ config/yaml/*.yaml  │ ← hand-curated
                              │ references/         │ ← human-eye source
                              └─────────────────────┘
                                        │
                  ┌─────────────────────┴────────────────────────┐
                  │                                              │
        Gametora / Umapyoi (JP + EN confirmed)         static YAML loaders
            scrapers (Selenium / HTTP via ──── UmaClient (Shakur)
            Transcend) — stamps JP and UTC          │
            Periods at extraction time              │
                  │                                 │
                  ▼                                 ▼
        models/entities/ (Digitan)         models/events/ (Daitaku-decorated)
          • Character / Trainee / Support     • Banner / Scenario / Story / Event
                  │                                 │
                  └─────────────────┬───────────────┘
                                    ▼
                        ┌──────────────────────┐
                        │ Pipeline (Rudolf)    │
                        │   _ensure_loaded()   │  ← lazy first-call
                        │   .run()             │  ← one-shot
                        └─────────┬────────────┘
                                  ▼
                    Bake.timeline(stages)  →  Timeline (events carry JP
                                              + any confirmed UTC Periods)
                                  │
                                  ▼
                    Predict (Matikanefukukitaru):
                      ScenarioPredictor → BannerPredictor
                      Vibes-based — heuristics over the in-memory
                      Timeline, no fitted model.
                                  │
                                  ▼
                    UTC-bearing Timeline (every retained event
                    has at least one UTC Period)
                                  │
                  ┌───────────────┴────────────────┐
                  ▼                                ▼
        Bake.academy(stages)          Bake.events(timeline)
        → academy.json                → events.json    (static/json/)
          + academy.schema.json         + events.schema.json
                                        (schema → config/schema/)
```

Curren Chan (image processing) runs alongside, invoked from media-bearing
models when their image fields are resolved; she doesn't show up in the
stage sequence above because she's a per-asset side-effect, not a stage.

## Key invariants

### `Pipeline` is a one-shot singleton

`Pipeline()` returns the same instance forever (via `SingletonMeta`).
`Pipeline.run()` flips `_ran` and refuses to do anything useful the second
time — it logs an error and returns early. The orchestrator is not a
reusable engine; it's a transaction.

`_ensure_loaded()` is lazy and idempotent. Reading `.metrics` or `.stage(name)`
will trigger it. `run()` calls it too. The first reentry into `Pipeline()`
mid-load sees the in-flight singleton, which is what makes the
auto-discovery / dependency-graph trick work.

### `TracenModels` auto-discover via subclassing

Every `TracenModels[Entity]` subclass registers itself at class-definition
time through `__init_subclass__`. `Pipeline._ensure_loaded()` iterates
`TracenModels._registry` and constructs each. To add a new stage, you
**define** a `TracenModels` subclass in `models/entities/` or
`models/events/` and **export** it from the relevant `__init__.py` — that's
it. There is no explicit registration list.

`load_order` on each collection's stats reflects the order in which their
construction *finished*, not registry index. That's a useful diagnostic for
transitive dependencies — don't "simplify" it back to registry index.

### Eager loading, intentionally N+1

Each `TracenModels` calls `self._fetch()` from its constructor. This is on
purpose: the scraper context (robots.txt, Selenium session, rate-limit
state) is held by `UmaClient` while the collection is loading. Lazy
per-entity fetching would force these contexts to be torn down and rebuilt
mid-loop. See [data-sources.md](data-sources.md) for the transport
contract.

Cold-start cost is real. [`jitter.py`](../../jitter.py) handles the followup
problem of "all cache entries expire on the same day."

### Periods are tz-tagged; predictions land alongside confirmed ones

Each `Event` carries a `Periods` collection — a list with at most **one
`Period` per `tzinfo`** (enforced on every mutation). At extraction time,
Transcend stamps:

- a **JP `Period`** from the source schedule (Cygames operates in Tokyo
  time; Gametora stamps event dates at 12:00 JST), and
- a **UTC `Period`** for any event whose EN release has already happened
  or been announced.

`Predict` runs *after* both are in place. Its job is to add a **predicted
UTC `Period`** to events that still only have a JP one. The `predicted`
flag in the baked output comes from *which* Period matched, not a field on
the Banner / Scenario itself — see [`Bake.events()`](../../horsetrader/output/bake.py).

`Period` and `Periods` are decorated `@daitaku` and they're pure
date-math primitives — they don't know or care about JST↔UTC conversion.
Translation between zones is the predictors' problem, not the calendar
layer's.

### The baked bundle is a typed, self-validating contract

The shape of `academy.json` / `events.json` is defined once, by the
`msgspec.Struct` DTOs in [`output/_records.py`](../../horsetrader/output/_records.py)
— Eishin's published wire contract. Everything else falls out of them:

- **The models map *into* the contract.** Each event's
  [`bake(period)`](../../horsetrader/models/events/event.py) returns its record
  type (built from the shared `Event._envelope()` plus its own fields); the
  entity mappers in [`_mappers.py`](../../horsetrader/output/_mappers.py) do the
  same for the academy side. The model→record dependency is why
  `output/__init__` exposes `Bake` lazily (PEP 562) — to keep `_records` a leaf
  the models can import without the `output → timeline → models` cycle.
- **Events are a discriminated union on `type`.** `EventRecord` is a msgspec
  *tagged union* (`tag_field="type"`); each concrete record declares its tag
  (`support`, `trainee`, `scenario`, `story`, `cm`, `anchor`, `anchoredevent`).
  The tag *is* the discriminator — there's no hand-computed `type` string. As
  before, `predicted` is an envelope field set from *which* `Period` matched,
  not a field on the model.
- **The JSON Schema is generated, not written.** `Bake._write` emits
  `<name>.schema.json` via `msgspec.json.schema(...)` straight from the same
  structs, so the published contract physically can't drift from the data. The
  web planner derives its TypeScript types from these schemas; the ETL owns the
  data, so it owns the contract.
- **The bake self-validates (fail-loud).** Before writing, `_write` decodes its
  own encoded bytes back through the struct and raises on mismatch — so a bundle
  that would violate the published schema is never written, and the site is
  never asked to build against bad data.

Optional-vs-null is deliberate: a field that's legitimately absent (`rewards`,
an anchored event's `name`) is **omitted** (msgspec `UNSET`), while a field
that's always present but unknown (`cm.name`, `scenario.title`) is emitted as
`null`. A missing anchored-event `name` additionally *warns* at load — it's a
displayable event, so the absence is a curation nudge, not a failure.

### Transport stays behind `UmaClient`

Network I/O, cache lookups, robots.txt parsing, sentinel/404 negative-cache
logic — all of it lives in [`horsetrader/transport/`](../../horsetrader/transport/)
behind `UmaClient`. Other modules use `try_get` (tolerant) or `get` (strict)
and never touch `UmaClientCache` directly, never string-match on transport
errors. If a request fails in a way callers should react to, expose it via
the client's API; don't leak `requests` exceptions upward.

### Fail loud

The ETL prefers raising / fatal logger / `SystemExit` over silent recovery.
Junk data is worse than no data. Default behaviour for "this entity is
missing a portrait" or "the schedule YAML disagrees with Gametora" is to
surface it, not paper over it with defaults or `try/except: pass`. See
[standards.md](standards.md).

## Where new code goes

| Adding… | Goes in | Owner |
| --- | --- | --- |
| A new scrapeable entity type | `models/entities/<thing>.py` (dataclass) + `<things>.py` (collection) | `@digitan` |
| A new event type that shows up on the timeline | `models/events/<thing>.py` + `<things>.py` | `@daitaku` |
| An extractor for an entity or event | `extractors/<source>/<thing>.py` | `@transcend` (uses `@shakur` for the wire) |
| A predictor for an unscheduled-EN type | `timeline/predictors/<thing>.py` | `@matikanefukukitaru` |
| The baked wire shape (a new field/record on the JSON) | `output/_records.py` (the `msgspec.Struct` DTOs) + the model's `bake()` / `output/_mappers.py` | `@eishin` |
| HTTP / cache / robots.txt | `transport/` | `@shakur` only |
| A new YAML-curated dataset | `config/yaml/<name>.yaml` (follow the [consolidated yaml shape](data-sources.md#consolidated-yaml-shape); the store auto-loads it, no whitelist) + an extractor in `extractors/static/` driving `store.py` primitives | dataset is hand-curated; extractor follows `@transcend` |

If you can't pick a character, push back rather than guess — that
mismatch usually means the work crosses boundaries and should be split.
See [semantics.md](semantics.md) for the personality-as-litmus-test rule.

## Conventional namespaces vs. character modules

Two parallel structures live in the package on purpose:

- **Conventional namespaces** (`models/`, `extractors/`, `timeline/`,
  `output/`, `transport/`) describe *what kind of code lives there* —
  navigable by anyone with general Python literacy, no Umamusume lore
  required. This is also where dataclasses (`Character`, `Banner`) live.
- **Character decorators** (`@digitan`, `@shakur`, …) imported from
  `horsetrader.semantics` mark *which role owns the code semantically*.
  Decorators are runtime no-ops; their docstrings carry the role text so
  IDE hover (or `help(digitan)`) is the fastest way to learn what a marker
  means.

Don't collapse these into one. A `Character` dataclass lives in
`models/entities/character.py` (the *type*) even though Digitan owns
knowledge about characters (the *behaviour*). The character decorator on
the class is how the two structures meet.

## See also

- [semantics.md](semantics.md) — the character roles in detail.
- [data-sources.md](data-sources.md) — which sources feed which extractors,
  and what's hand-curated.
- [prediction.md](prediction.md) — the predictor chain, in detail.
- [standards.md](standards.md) — code conventions the pipeline relies on.
