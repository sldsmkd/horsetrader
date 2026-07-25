# The ETL ↔ site contract

The one interface both repos must agree on. The `horsetrader` ETL bakes a static
bundle; the `horsetrader.site` planner consumes it. Everything here is **shared** —
change it on one side and the other must follow. This page is the canonical
definition of what crosses between them; ETL-side ingestion detail lives in
[etl/data-sources.md](etl/data-sources.md), and the site-side consumption stance
in [frontend/architecture.md](frontend/architecture.md) +
[frontend/trust-and-failure.md](frontend/trust-and-failure.md).

## The bundle

The ETL bakes a static, read-only bundle into the repo-root **`static/`** deploy dir:

- `static/json/academy.json` — entity reference data (characters, trainees,
  supports, races and their career occurrences, courses, racetracks, selectors).
- `static/json/events.json` — the dated event timeline (the forecast).
- `static/json/config.json` — non-timeline game constants and recipes the client
  expands procedurally (reward structures, rank maps, gacha rates).
- `static/img/**` — webp images, referenced by the JSON.

`static/` is the **deploy root** wrangler ships (gitignored, regenerated): the ETL
writes the JSON bundle + images here directly, and the site build writes
`index.html` + `js/app.js` into the same tree. The data is **read-only to the
site** — the ETL owns it.

## The schema (types can't drift)

The ETL publishes a JSON Schema for the bundle — `academy.schema.json` /
`events.schema.json` / `config.schema.json` — generated from its typed `msgspec`
DTOs and written to `config/schema/` (out of the shippable `static/` deploy dir —
it's the contract, not a deploy asset). The site runs `npm run gen:types` to compile those into
`core/bundle/*.gen.ts` (committed, never hand-edited; re-run when the ETL re-bakes
a changed shape). Because the site's types are *derived from* the ETL's schema,
the consuming cast cannot silently drift from the bake.

Schema emit is owned by `@eishin` on the ETL side — emit + self-validate on every
run (see [etl/architecture.md](etl/architecture.md)).

## Trust boundary

Data validity is the **ETL's** job, not the site's:

- The ETL is **fail-loud** and owns the bundle. Malformed data makes it fail
  *upstream*, before anything is written, so the site is never asked to build or
  deploy bad data — a classic sequential pipeline.
- The site therefore **trusts the bundle with a plain typed cast** and does **no
  build-time shape re-validation** — re-policing a contract it doesn't own would
  be redundant. (The site still never trusts *user* input — a separate boundary;
  see [frontend/trust-and-failure.md](frontend/trust-and-failure.md).)

## What crosses the wire: unpredictable-only

The bundle ships **only what the client cannot derive for itself** — curated
dates, anomalies, and event-specific amounts. The client generates the *standard,
procedural* streams itself (e.g. the 7-day login cycle, the `RewardGenerator`
cadence) rather than the ETL enumerating every occurrence.

The dividing line: **the client owns a procedural stream's *cadence*; the ETL owns
its *numbers*.** Every game-data value — not just the timeline, but the parameters
of client-generated streams (e.g. the carats from a daily login) — is the ETL's to
supply. A game-data literal hard-coded in client code is a smell; that value
belongs in the bake. So the bundle must carry those rates/parameters even for
streams the client expands on its own.

Gacha pull math follows the same rule. `config.json` carries the normal
game-wide pull constants (`spark_threshold`, `carats_per_pull`,
`paid_daily_pull`, rarity-pool rates, and featured pickup defaults using the UI's
`crystal` / `gold` / `silver` rarity language). A banner only needs to carry
per-pickup rate overrides when its rate differs from those defaults.

Event timeline records carry `start` / `end` as fully-qualified ISO datetimes
with the selected period's timezone offset (for the baked Global timeline, UTC),
not date-only labels. The site derives viewer-local or server-time calendar
labels from those instants at presentation time.

## Stable-key scheme (shared id vocabulary)

Every entity and event is identified by a `StableKey` of the form
**`<type>-<body>`** — a fixed namespace token first, so any key is routable by
splitting on the first `-`. The body is either a game-db id (Gametora) or an
invented slug/sequence. Both sides join bundle data on these keys.

| Namespace | Key shape | Example |
| --- | --- | --- |
| character | `char-<slug>` | `char-oguri-cap` |
| support | `support-<id>-<slug>` | `support-10001-special-week` |
| trainee | `trainee-<id>-<slug>` | `trainee-100101-special-week` |
| race | `race-<id>` | `race-1023` |
| course | `course-<id>` | `course-10506` |
| racetrack | `racetrack-<slug>` | `racetrack-nakayama` |
| banner | `banner-<id>` | `banner-30003` |
| scenario | `scenario-<nn>` | `scenario-01` |
| story | `story-<nnn>` | `story-001` |
| cm | `cm-<nnn>` | `cm-001` |
| holiday | `holiday-<kind>-<year>` / `holiday-marketing-<slug>` | `holiday-golden-week-2026`, `holiday-marketing-starhorse-4` |
| anniversary | `anniversary-<version>` | `anniversary-3_0` |
| item | `item-<id>` | `item-00043` |

Race records carry their career availability inline as `occurrences`; an
occurrence is not independently keyed because it has no identity outside its
owning fixture:

```json
{
  "name": "Arima Kinen",
  "occurrences": [
    {"course": "course-10506", "career_class": "classic", "month": 12, "half": "late"},
    {"course": "course-10506", "career_class": "senior", "month": 12, "half": "late"}
  ]
}
```

`course` is nullable only for adaptive named fixtures whose venue/distance is
generated from the trainee's career. `career_class` is `junior` | `classic` |
`senior`; `half` is `early` | `late`. Debut, Maiden, and EX are generated
pseudo-races and therefore are not nested occurrences of a named race.

**Reward keys are not stable keys.** Rewards are a fixed serialisation vocab
bundled under an event's `rewards` object (`{"free_carats": 2160, "support_tickets": 2,
…}`) — bare + pluralised; the client reads one object rather than scanning
top-level keys. A repeating bonus appears under `generator` (`{"free_carats": 564,
"repeat": 10}`).

ETL-side rules for *assigning* these keys (the `KEY_PREFIX` ClassVar, holiday
`<kind>` parsing, and byte-for-byte curated YAML keys) live in
[etl/data-sources.md](etl/data-sources.md#stable-key-scheme).

## Optional flags (presence-encoded, absence-defaulted)

Some event properties are **optional booleans**. The bake ships the flag only when
it *diverges from the default*, so the common case carries nothing. The client must
read each by an **explicit comparison against that flag's default** — never by
truthiness on a possibly-absent key (`if (ev.flag)` mis-reads absence and assumes
presence the contract doesn't promise).

The default is **per-flag, not global** — read the table, don't guess:

| Flag | Present means | Absent means | Client reads |
| --- | --- | --- | --- |
| `visible` | as set | **visible** (default true) | `ev.visible !== false` |
| `rushable` | as set | **not rushable** (default false) | `ev.rushable === true` |

Note the asymmetry: `visible` defaults *true* (opt-out — you mark the rare hidden
event), `rushable` defaults *false* (opt-in — you mark the subset that can be
rushed). Optionality keeps the bundle terse and is backward-compatible: an older
bake missing a newer flag simply reads as that flag's default.

> On the ETL side these are composed as mixins; that's an authoring detail invisible
> across the wire — all the client sees is the optional field (or its absence).

## Failure model handoff

The ETL has three failure tiers; the site keeps the same three, relocated to where
the audience changes:

| ETL tier | Site equivalent | Audience |
| --- | --- | --- |
| library `raise` / pipeline-fatal `SystemExit` | **hard guard** — build fails upstream, the site never ships bad data | the dev, in the pipeline |
| (bundle load failure) | **runtime-fatal** — visible DOM error panel + `console.error` | the user sees "couldn't load"; dev gets the stack |
| per-entity `warning` + continue | **per-item soft** — skip one bad record + `console.warn`, don't nuke the page | neither is blocked |

Shape drift is the ETL's brick to throw, never the site's — see
[frontend/trust-and-failure.md](frontend/trust-and-failure.md).

## Cross-side changes

There is no shared handoff file. A change that needs *both* sides at once is a
**scope-creep signal**: sessions are single-purpose (ETL *or* site, not both).
Note what the other side needs and do it in a **subsequent session** — don't
reach across the boundary mid-task.

## See also

- [domain.md](domain.md) — the game-side concepts these keys and events model.
- [etl/data-sources.md](etl/data-sources.md) — how the ETL produces the bundle.
- [etl/architecture.md](etl/architecture.md) — the bake stage ([`../horsetrader/output/bake.py`](../horsetrader/output/bake.py)).
- [frontend/architecture.md](frontend/architecture.md), [frontend/trust-and-failure.md](frontend/trust-and-failure.md) — the consuming side.
