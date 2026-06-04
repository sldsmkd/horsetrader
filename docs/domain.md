# Domain knowledge

Game-side facts the ETL pipeline depends on. This is the *ETL slice* —
pull mechanics, spark thresholds, sidebar UX and similar player-tooling
concerns live in the web repo's docs, not here.

If you're new to Umamusume, none of this is obvious from the code alone,
and most of it is the kind of thing that surfaces as "why is the
prediction off by a day?" or "why is there a CM in this gap?" three
months from now.

## Time and resets

### JST is the source of truth

Cygames operates in Tokyo. Every JP-side date the ETL ingests is JST.
**JST = UTC+9, no DST** — Japan doesn't observe daylight saving, so the
offset is a constant `timedelta(hours=9)` ([`horsetrader.core.JST`](../horsetrader/core/period.py)).

Gametora stamps event dates at **12:00 JST** (noon local). The
[`extractors/gametora/dates.py`](../horsetrader/extractors/gametora/dates.py)
parser preserves this — date-only truncation belongs at the presentation
layer, not in transit.

### Server reset and content drop windows

| Region | Daily reset | Next content drop |
| --- | --- | --- |
| JP | 00:00 JST | 12:00 JST same day (+12h after reset) |
| Global (EN) | 15:00 UTC (= 00:00 JST) | 00:00 UTC next day (+9h after reset) |

This is why `BannerPredictor` and `ScenarioPredictor` stamp predicted EN
periods at **22:00 UTC** — that's the canonical "the new banner has
appeared on Global" instant, slightly before the next-day-00:00-UTC line
crosses for most of the player base.

For consumer reasoning, the practical rule is: a JP date string
"2026-05-28" and a UTC string "2026-05-28" are not the same day from
00:00–15:00 UTC. Anywhere the ETL compares them, do it on the
zone-tagged `datetime`, not the date string.

## Scenarios

JP scenarios release on **the 24th of a month**. The *cadence* changed
mid-life, and our `jp.start` data pins the inflection exactly:

- **Through U.A.F. (2024-02-24): 2 per year**, both on the anniversary axis
  (late Feb = full anniversary, late Aug = half-anniversary), ~180-day gaps.
- **From Great Food Festival (2024-06-26): 3 per year**, ~120-day gaps (a
  rough Feb / Jun / Oct rhythm). Only the **February** scenario still lands on
  the anniversary; the other two are **off-axis**.

This shift matters for anchoring: scenario-launch and anniversary-beat *used*
to be the same date and now coincide only in February. The first half-anniversary
to ship *without* a scenario was 3.5 (2024-08-24) — GFF had already gone out in
June. See [`config/yaml/scenarios.yaml`](../config/yaml/scenarios.yaml).

EN doesn't follow the 24th cadence. Releases land on weekdays that
cluster — `ScenarioPredictor` uses the empirical EN weekday histogram
across confirmed releases as its weekday signal. Day-of-month is
**not** a useful signal for EN under compressed acceleration; don't
reintroduce it.

Scenario keys are `scenario-N`, **release order**. JP and EN share the
key. Gametora's display order occasionally differs from release order
(the `art:` URLs for `scenario-3` and `scenario-4` are deliberately
swapped relative to Gametora's display) — see [data-sources.md](etl/data-sources.md).

### Scenario / anniversary beats always bundle a meta support card

**Provable in our own scraped data, zero counterexamples across 15 beats
(2021–2026):** every scenario launch and every anniversary date co-releases at
least one support card that the JP PvP meta rates highly. The beat is the
meta-support channel.

From **Grand Masters (2023-02-24) onward** the bundle hardened into a fixed
shape: the scenario's **friend/group (PAL) card** ships *alongside* a durable
top-tier stat card, both stamped with the scenario's exact launch date:

| Beat | Friend/group card | Bundled meta stat card |
| --- | --- | --- |
| Grand Masters 2023-02 | 3 Goddesses (group) | **Mejiro Ramonu** (wit) |
| Project L'Arc 2023-08 | Satake Mei (PAL) | **El Condor Pasa** (speed) |
| U.A.F. 2024-02 | Ryoka Tsurugi (PAL) | **Orfevre** (guts) |
| Mecha 2024-10 | *(none)* | **Air Shakur** / **Daiwa Scarlet** |
| 3.5 anniversary 2024-08 | — | **Tokai Teio** / **Satono Diamond** |

Before Grand Masters the same co-release existed but the bundled card was
**scenario-tuned and transient** — strong *for that scenario* then fell off
(Rice Shower power w/ Aoharu, Narita Top Road speed w/ Trackblazer, Agnes
Tachyon speed w/ Grand Live). Same monetisation mechanic, not yet the durable
meta card. (This is the same ~2.0-anniversary "operational hardening" inflection
that shows up in the [CM zodiac→category transition](#champions-meetings-cm).)

Post-2024 nuance: the **anniversary-axis** beats (Feb / Aug 24) get the premium
speed/wit/guts meta cards; the **off-axis** scenarios (Jun / Oct) still bundle a
top card but often in a lower-value category (GFF → Nishino Flower power, DYI →
Tamamo Cross power).

**Why the ETL cares:** these bundled banners co-release on the scenario /
anniversary date, which is already a `BannerPredictor._ANCHOR_TYPES` anchor — so
pass 1 (anchor-snap) already places them. This finding *explains why that pass
is reliable* and is the high-confidence end of the banner-intent spectrum. (Two
weaker, not-yet-modelled couplings sit at the other end: the pre-CM "Banner C"
competitive whalebait, which needs CM track metadata, and the seasonal-holiday
trainee banners, which surface fan-favourite *trainees* for emotional resonance
rather than meta supports.) Meta-strength itself is **not** a baked field — it's
scenario- and region-dependent and retunes every ~4 months; this is a statement
about *release coupling*, not a card-rating system.

## Champions Meetings (CM)

10-day competitive events. Six of the ten days carry meaningful state in
our data (days 0–3 are pre-registration and untracked):

| Day | Phase |
| --- | --- |
| 0–3 | Pre-registration (not tracked) |
| 4–5 | Qualifiers |
| 6–7 | Group stages |
| 8 | Rest / last-minute training |
| 9 | Finals |

**Which window each source reports — marketing vs. reality.** The two sources
disagree on a CM's span *by design*, because they describe different things:

- **JP (Gametora scrape) = the competition core, always exactly 6 days.**
  Gametora records *only* competitive play — the qualifier→finals span (e.g.
  `14日 4:00 – 20日 3:59`); the pre-registration days 0–3 aren't in it. This is
  invariant: all 45 scraped CMs are 6 days at date level (the start hour varies
  3:00/4:00 JST, but the span doesn't). So the **JP `Period` is always the
  6-day core.**
- **EN (Cygames announcement) = the full availability window (usually 10 days,
  occasionally 9).** The monthly release-schedule announcement gives the *whole*
  event including the lead-in (drop **22:00 UTC**), aligned to the concurrent
  banner/content cycle — in the May 2026 schedule the Taurus Cup window
  (May 10 22:00 – May 20 21:59 UTC) is *identical* to that month's New Trainee
  banner window. **Curated EN dates use this announcement window** (the EN
  source of truth — see [data-sources.md](etl/data-sources.md)). The span varies on
  the EN side, not JP: the lead-in is what flexes.

Consequence: **the JP and EN `Period`s have different spans on purpose** — JP is
the fixed 6-day competition core, EN is the marketing/availability window that
adds the lead-in on the front. A naive equal-span JP→Global projection therefore
*under-counts* a CM's EN window: a predicted CM would inherit the 6-day JP span
and miss the ~3–4-day pre-registration lead-in EN tacks on.

**Predict from the final, not the opening.** The competition *final* is
precomputed and immune to meta changes; the opening drifts (Cygames flexes the
registration/qualifier timing to avoid meta-changing banners during the
competitive phase — the Oguri Cap rule below — but keeps the final fixed). So
the [`ChampionsMeetingPredictor`](../horsetrader/timeline/predictors/champions_meeting.py)
anchors on the **final day**: it maps JP-final → EN-final through a `DateMapper`
of confirmed CM pairs, then rebuilds the EN availability window *backwards* from
that final using the typical confirmed EN span (≈10 days). Final-to-final also
neutralises the asymmetric front-padding for free. It runs as its own pass —
after `BannerPredictor`, before the generic fallthrough (which would otherwise
mis-map a CM off its opening day with the wrong 6-day span). See
[prediction.md](etl/prediction.md).

CM track data — venue, surface, distance, direction, condition, season,
weather — is currently MVP scaffolding: scraped from Gametora's JP event
pages, with manual venue overrides for the ones Gametora can't resolve (US
venues like Del Mar, Santa Anita). Those overrides aren't wired into the new
ETL yet — the old `cm_tracks.yaml` sits in `references/import/` for reference.
When the races expansion ships, real track metadata will come from wikiwiki /
wikiru and replace both. Don't over-engineer `TrackInfo` in the meantime.

### The Christmas Oguri rule

Mid-CM-8 (Sagittarius Cup 2021, JP), Cygames released Christmas Oguri Cap
(Ashen Miracle) whose unique Festive Miracle broke the long-distance
meta. Players who couldn't pull or rebuild in time were locked out of
competition. The backlash was enormous.

It produced Cygames' standing live-ops rule: **no character banners
during the active phase (first 5 days) of a Champions Meeting**.

Implications for prediction:

- Pre-CM-8 JP violations exist in the historical data. They are **not**
  to be replicated when predicting EN. The deferred outlier-rules hook
  (see [prediction.md](etl/prediction.md)) is the right home for this.
- Post-CM-8, banners cluster *just before* a CM as intentional
  meta-seeding. This is a tighter anchor signal than global speedup
  alone — and a reason BannerPredictor pass 2 will likely need
  CM-awareness, not just acceleration.
- Banner-CM overlap *outside* the first 5 days is normal and intentional
  in both JP and EN. Cygames publishes banners starting as late as the
  rest day (day 8). No de-overlap constraint applies generally — only
  the first-5-days rule.
- EN CM scheduling appears fully automated (cron-based): Fri/Sat heavy,
  some Tuesdays. No human gating to specific business days.
- A small number of post-CM-8 JP violations exist and are still under
  user research — they need context (track, banner type, format) to
  decide if they're true exceptions to the rule.

## Legend Races

Recurring PvE events, each a **real-world race** (Japan Cup, Satsuki Sho, Arima
Kinen, …) run as an **ordered sequence of per-trainee legs**. Each leg pits the
player against one *specific trainee variant* (not just a character — e.g.
Winning Ticket (Steampunk)) for a contiguous **~3-day set**; when one set ends
the next begins, so the legs tile the overall window. 2–4 sets per race is
normal (≈120 total legs across the 53 JP occurrences so far). Sourced richer
than the wikiru event types — from Gametora's
[legend-race](https://gametora.com/ja/umamusume/events/legend-race) index
(JA page: JP window + legs + JP name; locale-less page: EN race name, joined by
the card's trainee set). See
[`extractors/gametora/legend_races.py`](../horsetrader/extractors/gametora/legend_races.py).

**Stable key.** `legendrace-NNN` by JP chronological ordinal (the same
order EN replays, so the EN overlay joins on it — like CM). Not rushable: the
legs are date-pinned daily windows, so there's no post-at-start choice (same
fixed-duration stance as a CM).

**Rewards (heuristic).** Carats are *temporal*, not a lump sum: **250 carats on
the first day of each set**, nothing between — modelled as a
`SequenceReward(FreeCarats)` over the window (250 at each leg's first-day offset,
`None` for off days). From the **8th occurrence onward** (when the reward tier
improved) each race also grants **2 gold + 1 rainbow crystal shard** at the end
(plain counters). Stamped in
[`rewards/rules.py`](../horsetrader/models/rewards/rules.py).

**Leg projection.** The scraped legs are JST; EN runs on different dates, so
`LegendRace._baked_legs` re-anchors each leg by its whole-day offset from the
JST window start onto the matched EN window's start date — the same offset basis
the carat sequence uses, so sequence index *i* lines up with leg *i*'s first
day. EN windows are curated in
[`config/yaml/legend_races.yaml`](../config/yaml/legend_races.yaml) (transcribed
from the maintainer's `config/pending/` capture); a race absent there stays
predicted via the fallthrough.

## Story Events

Time-limited narrative events featuring a themed group of trainees (up to
four 4⭐ characters) and associated support cards. They aren't competitive
events — no race registration, no CM overlap concerns — but they matter to
the pipeline for two reasons:

1. **Banner anchoring.** A story event always co-releases with at least one
   costume banner for the featured trainees. Once Story events are added to
   `BannerPredictor._ANCHOR_TYPES`, story EN dates can anchor those
   costume-banner predictions the same way anchor and Scenario dates
   do today.

2. **Stable key scheme.** Gametora assigns its own integer IDs
   (`story-event-1`, `story-event-2`, …) which are stored in
   `correlations["gametora"]`. The pipeline uses the **release-order
   ordinal** `story-001`, `story-002`, … as the stable key, because
   Gametora's `story-event-N` string caused substring collisions in
   `search()`.

**Images.** Three per story: `story-NNN.webp` (art — reconstructed from the
`thumb_title` URL), `story-NNN-thumb.webp` (icon from the event block), and
`story-NNN-banner.webp` (banner matched by date-sort ordinal against
`config/img/stories/story_NN_banner.png` reference files).

**Trainee resolution.** The character slug from the Gametora href *is* the
character's stable key. `Trainees().search(char_slug)` hits via
`character.match()`; the first result is used.

**Support resolution.** The support slug (`30297-agnes-digital`) *is* the
support stable key. `Supports().get(sup_slug)` is a direct lookup; no fuzzy
matching.

## Limited Missions

High-volume, **flat catalogue** of dated mission campaigns (the autumn G1
celebrations, anniversary missions, collab/tie-in mission sets, …). Each is a
window granting a fixed reward set — a meaningful carat source for below-lane
timeline density (≈41k carats across the full catalogue). Scraped from
Gametora's per-year history pages; **no curated YAML** (the EN side is itself a
live scrape, not a hand-maintained overlay). See
[`extractors/gametora/missions.py`](../horsetrader/extractors/gametora/missions.py).

**Two surfaces, one shared keyspace.** The JA history (`missions/history-{year}`,
launch 2021 →) is the substrate — JP title, JST window, and the reward rows. The
locale-less history (2025 →) is the EN overlay — EN title + UTC window. They
**join on the logo-image id** (`mission-NNN`): Global launched in 2025 and
renumbers from a low base, but **replays JP's original ids from the start**, so
EN's low ids line up with JP's *early-year* ids (EN `00111` = JP `00111` =
ジャパンC / "Japan Cup", same content). The trap is comparing same-*year* slices
(EN-2025 vs JP-2025) — that's a mismatch; the join is against the **full JP
history**, where JP is the substrate and EN the overlay, per the standing model.

**Stable key.** `mission-NNN` from the logo-image id. Not rushable (a mission
set is farmed across its window). **Rewards** are the scraped carat-economy
subset — resolved through the same `reward_for_gametora_icon` allowlist as story
events, so the long tail (manie, friend points) drops at debug. A mission that
hasn't reached Global has no EN window and stays predicted via the fallthrough;
those land at plausible-but-far-future EN dates (Global is ~3.7 years behind JP).

**Images deferred.** The JP/EN logo thumbs aren't baked in v1 — missions are the
highest-volume type, so they'd add the most image weight for the least per-item
value; the record carries `name` only (consistent with CM). Easy follow-up.

## Banners

Banner identity and media conventions:

- **Key:** `<gametora-id>-banner` (e.g. `30002-banner`).
- **Image:** `https://gametora.com/images/umamusume/gacha/img_bnr_gacha_{id}.png`.
- **Type:** banners on the same Gametora page mix support and character
  gachas — the extractor dispatches by Gametora's "Support Card Gacha" /
  "Character Gacha" labels.

Contents-matching rules (which trainees / supports a banner pickups
resolve to) are part of the data contract — they live in entity code but
are documented in [data-sources.md](etl/data-sources.md).

## Characters

Missing portraits are usually **NPCs**, not data gaps. Academy staff,
guest rivals from scenarios, and unreleased characters all show up in
the corpus without portraits. `missing_portrait > 0` in stats is not a
defect by default — investigate only if a *playable* character is
missing one. Don't add defensive "fill the portrait somehow" logic; let
the absence speak.

Keys are kebab-case slugs (`silence-suzuka`); numeric Gametora IDs
(`1002` etc.) are kept on `Character.gametora_id` for internal joins
but the primary lookup surface is the key.

## Rewards

Events hand out rewards — carats, scout tickets, crystal shards — modelled
in `models/rewards/`. Two shapes matter to the domain:

- **Counter rewards** (`CounterReward` subclasses: `FreeCarats`, `TraineeTicket`,
  `SupportTicket`, `RainbowCrystalShard`, `GoldCrystalShard`) are a flat
  `amount` of one item. They add and scale *by type* — `FreeCarats(150) +
  FreeCarats(150) == FreeCarats(300)`, `FreeCarats(150) * 5 == FreeCarats(750)` — and
  adding two different counters raises rather than silently merging. This
  is what lets rules stamp `[FreeCarats(80), FreeCarats(80)]` or `[FreeCarats(160)]`
  interchangeably and lets bake fold them to the same `{key: amount}`.
  `PaidCarats` is the corollary type — a *distinct* currency (some purchases
  need paid carats specifically, e.g. a banner's discounted single pull at 50
  paid vs 150 free), sharing only the icon (`item-00043`). It's never *handed
  out*, so it's never scraped (`from_icon = False`) and no event bakes it today.
  It exists so `paid_carats` is a first-class resource; paid *sources* (e.g. a
  £5 daily pack granting paid + free carats) are a later ticket, and paid-only
  *spends* are a client-side concern.

- **`RewardGenerator`** wraps one counter plus a `repeat` count — a reward
  paid out repeatedly, typically a **daily login bonus** over an event's
  run. The ETL deliberately does *not* model the cadence (which days it
  pays, when each instalment unlocks); that's the client's job. We carry
  only the unit reward and how many times it lands. `total()` collapses it
  to `reward * repeat` for callers wanting the headline figure.

  **One generator per event.** Overlapping weekly / new-player / holiday
  login bonuses are *separate events*, not multiple generators on one
  event — so the baked shape is a single object, not a list.

- **`SequenceReward`** is a **daily login bonus** for a *single* counter type,
  spelled out day by day: each login-day pays an amount of that type or `Null`
  for a day it isn't paid. Because the type is fixed, a skip is the **absence of
  that type** (`Null` in YAML, `None` in the model, *not* `0`) — anniversary
  tables pay every day, but some days give a welfare/support card we don't
  track, and those days are `Null`. (A bare `0` is accepted as shorthand.) A
  second type we *did* track wouldn't fold in here — it'd be its own
  `SequenceReward`. The `reward_type` is a plain `CounterReward` subclass, never
  a sequence or generator; the event stays open indefinitely, so the ETL models
  no end. `total()` sums the paying days.

  Note the two reward shapes coexist on an anniversary event: a one-time
  `free_carats` gift at the start (a plain counter) sits beside the `sequence` daily
  login table — `{ "free_carats": 3000, "sequence": { "type": "free_carats", … } }`.

**Baked shape.** A `Rewards` list folds (in
`models/rewards/rewards.py::rewards_to_baked`) to a JSON object — the value of an
event's `rewards` key: counters become `{key: amount}` (same keys summed); a
`RewardGenerator` serialises under `generator` as
`{<reward key>: amount, "repeat": n}`, keeping the per-payout amount and
the repeat separate so the client multiplies; a `SequenceReward` serialises
under `sequence` as `{"type": <reward key>, "sequence": [...]}` with absent days
as `null`. Keys are bare + pluralised
(`free_carats`, `gold_crystal_shards`, …); the `rewards` wrapper namespaces them.

```json
{ "free_carats": 660, "gold_crystal_shards": 3,
  "generator": { "gold_crystal_shards": 3, "repeat": 5 } }
```

**Two ways a reward lands on an event:**

- **Inferred policy**, owned by `models/rewards/rules.py` (e.g. story events
  stamp 660 carats + 3 gold shards off-table; Original-debut banners stamp
  carats). New policy is a new function there, not edits to event
  aggregators.

- **Curated data** in `config/*.yaml`. Anchor login bonuses (New Year /
  Golden Week / anniversary) are *known*, not inferred — so they're authored
  directly on the anchor, as a top-level `rewards:` block written in the
  **same shape the client reads** (the bake output above). The bonus is
  identical across regions, so it's a shared field, not per-locale:

  ```yaml
  anchor-golden-week-2021:
    rewards:
      generator:
        free_carats: 564
        repeat: 10
    jp: { start: 2021-04-30T12:00:00+09:00 }
    en: { start: 2025-08-07T22:00:00+00:00 }
  ```

  `rewards_from_baked()` parses that block back into a `Rewards` — the inverse
  of `_mappers._rewards`, so the two must stay in sync. It fails loud on an
  unknown key or malformed shape (curated YAML is the editor's feedback loop).

## Anchored events

Some campaigns don't have a date of their own — they're defined *relative* to a
tentpole. A **New Year Countdown** runs the week up to New Year; an
**Anniversary Celebration** and its **Encore** tile the days after the
anniversary. They're curated as `AnchoredEvent`s **inline in the consolidated
static files**, beside the anchor they hang off (the New Year ones sit in
[`config/yaml/holidays.yaml`](../config/yaml/holidays.yaml) next to `anchor-new-year-*`),
and gathered from the merged store by their `before-`/`during-`/`after-` key
prefix — file location doesn't matter. They never carry an explicit date.
(Authoring crib: [`config/yaml/anchors.txt`](../config/yaml/anchors.txt).)

Each entry pins to **one edge** of an `anchor` (the stable key of another
event) and runs for a `duration`:

- **`before-*`** ends *at* the anchor's start, running `duration` before it
  (a lead-in / countdown).
- **`after-*`** begins *at* the anchor's end, running `duration` after it
  (an extension). **`during-*`** is a readability synonym for `after-` (a part
  that runs *during* a multi-part celebration) and resolves to the same
  placement. The key prefix is load-bearing — it sets the direction.

The prefix is deliberately load-bearing rather than a separate field: these get
edited only a few times a year, so a self-evident key you can copy from a
neighbour beats one that sends you to the docs or loader to learn a convention.
It's also the selector: every loader picks its rows from the merged store by
key pattern (`store.select(...)`), so the anchored loader claims
`^(before|during|after)-` while the region loaders claim disjoint shapes — no
filename involved, the prefix alone routes each entry to its loader.

`duration` is ISO-8601 restricted to fixed-length components
(weeks/days/hours/minutes/seconds); years and months are rejected because they
aren't a constant span.

**Anchors are points, anchored events are spans.** Base anchors (New Year /
Golden Week / anniversary / scenario launches) are span-0 instants, so their
start and end edges coincide. An anchored event has a real span, and resolving
it *exposes a new edge* — which is why these **chain**: an `after-*` can anchor
to another anchored event, and the chain tiles contiguously (each link begins
exactly where its parent ended). You only ever anchor to a well-defined edge
*point*, never to a span.

**Two-tz resolution** (the recursion lives in
[`models/events/anchored.py::resolve_anchored`](../horsetrader/models/events/anchored.py),
shared by both passes):

- **JST, at load.** Every anchor has a JST launch (JST is source of truth), so
  placement is deterministic and total. The collection resolves the whole graph
  to a fixpoint against the curated launch collections (the unified `Anchors` —
  New Year / Golden Week / anniversaries — and scenarios) plus its own chains,
  and **fails loud** if anything is left
  unmoored — a missing anchor, no JST period, or a cycle. That throw is the
  editor's feedback loop, the same as the rest of the curated YAML.
- **UTC, in prediction.** The EN date is derived, not regressed:
  [`AnchorPredictor`](../horsetrader/timeline/predictors/anchored.py) (Mati,
  runs *last*) re-runs the same resolver over the UTC edges the other predictors
  have just stamped, so `campaign.utc = anchor.utc ± duration`, chains included.
  A campaign inherits its anchor's `predicted` flag. Here an unreachable anchor
  is **not** fatal — the base anchor simply wasn't predictable, so the campaign
  stays unpredicted like any other.

In `events.json` an anchored event bakes like an anchor (calendar `type`, `name`,
optional `rewards`) but with a real `start`/`end` range plus `relation`
(`before`/`after`) and the `anchor` key for grouping.

## See also

- [data-sources.md](etl/data-sources.md) for which file or scraper each
  fact above is sourced from.
- [prediction.md](etl/prediction.md) for how these rules are (and aren't)
  reflected in predictor logic today.
