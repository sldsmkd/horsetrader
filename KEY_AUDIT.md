# Stable-key audit & standardisation plan

Working doc (2026-05-31). Goal: a single consistent stable-key scheme across every
baked namespace, with externally-sourced ids kept separately where they aren't the
key itself. Captured here so it can be actioned independently of the
schema/msgspec work (which lands first — see bottom).

## Current keyspace

| Namespace | Current format | Example | Authored by | Consistent? |
|---|---|---|---|---|

| characters | `<slug>` | `oguri-cap` | invented slug | ❌ no type marker |
char-oguri-cap


| supports | `<id>-<slug>` | `10001-special-week` | game id (5-digit) + slug | ❌ id-led, no marker |
support-10001-special-week

| trainees | `<id>-<slug>` | `100101-special-week` | game id (6-digit) + slug | ❌ id-led, no marker |
trainee-100101-special-week

| banners | `<id>-banner` | `30003-banner` | gametora id + **suffix** | ⚠️ suffix not prefix |
banner-30003

| scenarios | `scenario-NN` | `scenario-01` | invented sequence | ✅ prefix |
scenario-NN

| stories | `story-NNN` | `story-001` | gametora-n, zero-padded | ✅ prefix |
story-NNN

| cm | `cm-NNN` | `cm-001` | invented sequence | ✅ prefix |
cm-NNN

| anchors | `anchor-<kind>-<ver>` | `anchor-anni-3_0`, `anchor-new-year-2022`, `anchor-golden-week-2021` | invented | ✅ prefix (PARSED for `kind`) |
??? does kind even have any code meaning - I assumed it was just for humans editting the yaml

| anchoredevents | `<relation>-<body>` | `before-new-year-2022`, `after-new-year-2022-hangover`, `during-new-year-2022` | invented | ⚠️ relation-led, no type marker |
before-new-year-2022
after-new-year-2022
during-new-year-2022 - cast to after-new-year-2022 and throw an error if it collides - then deeper logic can ignore it as it's yaml parsetime only.

| items | `item-<id>` | `item-1234` | `item-` + gametora id | ✅ prefix |
item-1234

| rewards | bare vocab token | `carats`, `trainee_ticket` | Reward ClassVar | n/a (fixed vocab, not entity keys) |
reward_carats
reward_trainee_tickets # pluralise - find the source of this and fix there.


## The offenders (only three)

Four namespaces already follow `<type>-<body>` (scenario / story / cm / anchor /
item). Only three break the pattern:

1. **Entities (character / support / trainee) carry NO type marker.** The only way
   to tell `100101-special-week` (trainee) from `10001-special-week` (support) from
   `special-week` (character) is to know the game's id-width convention
   (6-digit / 5-digit / none). That's an implicit contract a consumer must
   reverse-engineer.
2. **Banners use a `-banner` SUFFIX, not a prefix** — and the `30003` is the
   gametora banner id, which is *also* stored in `correlations: {gametora: 30003}`,
   so it's duplicated.
3. **Anchored events are relation-led** (`before-` / `after-` / `during-`).

## Why now / corroborating signal

- We're still inside the output-breaking window (free to change serialised shape
  until the FE rebuild ships).
- The keys are about to be documented in the published JSON Schema, so the right
  moment to settle the scheme is before that contract goes out.
- The site has ALREADY asked for this. Its `site/docs/persistence.md` anti-pattern
  table lists, verbatim: `30096-banner` vs `support:30107-maruzensky` →
  "one consistent key scheme". `30096-banner` is our current banner format. The
  consumer has flagged our mixed scheme as something it doesn't want to inherit.

## Two things that make this heavier than a find-and-replace

### 1. Curated YAML keys ARE the stable keys, byte-for-byte

(See the "YAML keys must match stable keys" rule.) Restandardising rewrites the
entry keys — and any intra-file cross-references — in:

- `static/yaml/banners.yaml`
- `static/yaml/holidays.yaml`  (anchors + anchored events; anchored entries
  reference `anchor:` keys)
- `static/yaml/anniversaries.yaml`
- `static/yaml/champions_meetings.yaml`
- `static/yaml/scenarios.yaml`
- `static/yaml/stories.yaml`

### 2. Some code PARSES key structure — format is load-bearing here

- `horsetrader/models/events/anchor.py:54` — `kind` parsed from the `anchor-<kind>-`
  prefix (`removeprefix("anchor-")` then `startswith`). Keep the `anchor-` prefix
  and this is unaffected.
- `horsetrader/extractors/static/anchored.py:48-50` — the `relation` field is
  DERIVED from the `before-`/`after-`/`during-` prefix. If anchored keys change,
  this parsing must change (or relation becomes an explicit YAML field).
- `horsetrader/timeline/predictors/champions_meeting.py:33` — CM number is
  `str(key).split("-")[1]` off `cm-001`. Unaffected if `cm-` prefix stays.

(Banner's `removesuffix("banner")` at `banner.py:64` is on the class NAME, not the
key — irrelevant. Story's `rsplit("-",1)[1]` is on the gametora key, not our
stable key — irrelevant.)

## Proposed rule

**Every stable key is `<type>-<body>` — one fixed namespace token, routable by
splitting on the first `-`.** Result:

```
character-oguri-cap              support-10001-special-week     trainee-100101-special-week
banner-30003                     scenario-01    story-001    cm-001    anchor-anni-3_0
```

Already-compliant namespaces (scenario/story/cm/anchor/item) are untouched.

## Two judgment calls (decide before actioning)

### A. Entity ids — keep in the body, or strip to `correlations`?

- **Keep (recommended):** `support-10001-special-week`. The game id is the genuinely
  stable anchor, it's human-debuggable, and `correlations` already holds it
  redundantly. No new machinery.
- **Strip:** `support-special-week` + id only in `correlations`. Requires inventing
  + registering our own id sequence to disambiguate collisions (e.g. multiple
  support cards for one character). More machinery for no clear win.

### B. Anchored events — the `before-`/`during-`/`after-` prefix does double duty

It's both the key namespace AND the source of the `relation` field (parsed in
`static/anchored.py`), AND it's a deliberate curation ergonomic (copy-a-neighbour
keys for rarely-edited YAML; region-namespace doc references it). `relation` is
also already an explicit baked field on the record.

- **Option (a) — leave as the one principled exception (recommended):** the three
  relation prefixes collectively ARE the anchoredevent namespace. Consumer routes
  `before-*`/`after-*`/`during-*` → anchoredevent. Least disruption; matches the
  copy-a-neighbour ergonomic.
- **Option (b) — `anchored-<body>` prefix + explicit `relation:` YAML field.**
  Cleaner uniform contract, but undoes the copy-a-neighbour ergonomic and adds a
  field to hand-curate; the prefix-parsing in `static/anchored.py` is deleted.

## Changes required (once the calls are made)

1. Rewrite entry keys (+ intra-file `anchor:` refs) across the six curated YAMLs.
2. Update construction sites that build keys from source ids:
   - `models/events/banner.py:179` (banner key) + the gametora correlation already
     present at `extractors/gametora/banners.py:169`.
   - entity loaders: `support.py`, `trainee.py`, `character.py` (prefix added).
3. Adjust key-parsing code per the calls above (anchor stays; anchored maybe; cm
   stays).
4. Regenerate the bake; the JSON Schema (DTO-derived) picks up the new patterns
   automatically.
5. Sanity-check `contents` reference arrays in events.json now carry the new
   prefixed entity keys.

## Sequencing

Schema/msgspec work lands FIRST (self-contained, lower-risk, unblocks the site,
and the schema regenerates for free when keys change). This key restandardisation
is the focused second pass. The site is not building against the current keys yet
(work is happening in the ETL workspace, not the site), so there's no live
consumer to break.
