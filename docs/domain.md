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

JP scenarios release on a fixed cadence: **the 24th of a month**, on or
near the **anniversary** (late Feb / late Aug for major drops, occasional
mid-cycle scenarios on the 24th of other months). See
[`static/yaml/scenarios.yaml`](../static/yaml/scenarios.yaml) — the `jp.start`
dates make the pattern obvious.

EN doesn't follow the 24th cadence. Releases land on weekdays that
cluster — `ScenarioPredictor` uses the empirical EN weekday histogram
across confirmed releases as its weekday signal. Day-of-month is
**not** a useful signal for EN under compressed acceleration; don't
reintroduce it.

Scenario keys are `scenario-N`, **release order**. JP and EN share the
key. Gametora's display order occasionally differs from release order
(the `art:` URLs for `scenario-3` and `scenario-4` are deliberately
swapped relative to Gametora's display) — see [data-sources.md](data-sources.md).

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
  (see [prediction.md](prediction.md)) is the right home for this.
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
`static/img/stories/story_NN_banner.png` reference files).

**Trainee resolution.** The character slug from the Gametora href *is* the
character's stable key. `Trainees().search(char_slug)` hits via
`character.match()`; the first result is used.

**Support resolution.** The support slug (`30297-agnes-digital`) *is* the
support stable key. `Supports().get(sup_slug)` is a direct lookup; no fuzzy
matching.

## Banners

Banner identity and media conventions:

- **Key:** `<gametora-id>-banner` (e.g. `30002-banner`).
- **Image:** `https://gametora.com/images/umamusume/gacha/img_bnr_gacha_{id}.png`.
- **Type:** banners on the same Gametora page mix support and character
  gachas — the extractor dispatches by Gametora's "Support Card Gacha" /
  "Character Gacha" labels.

Contents-matching rules (which trainees / supports a banner pickups
resolve to) are part of the data contract — they live in entity code but
are documented in [data-sources.md](data-sources.md).

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

- **Counter rewards** (`CounterReward` subclasses: `Carats`, `TraineeTicket`,
  `SupportTicket`, `RainbowCrystalShard`, `GoldCrystalShard`) are a flat
  `amount` of one item. They add and scale *by type* — `Carats(150) +
  Carats(150) == Carats(300)`, `Carats(150) * 5 == Carats(750)` — and
  adding two different counters raises rather than silently merging. This
  is what lets rules stamp `[Carats(80), Carats(80)]` or `[Carats(160)]`
  interchangeably and lets bake fold them to the same `{key: amount}`.

- **`RewardGenerator`** wraps one counter plus a `repeat` count — a reward
  paid out repeatedly, typically a **daily login bonus** over an event's
  run. The ETL deliberately does *not* model the cadence (which days it
  pays, when each instalment unlocks); that's the client's job. We carry
  only the unit reward and how many times it lands. `total()` collapses it
  to `reward * repeat` for callers wanting the headline figure.

  **One generator per event.** Overlapping weekly / new-player / holiday
  login bonuses are *separate events*, not multiple generators on one
  event — so the baked shape is a single object, not a list.

**Baked shape.** A `Rewards` list folds (in `output/_mappers.py::_rewards`)
to a JSON object: counters become `{key: amount}` (same keys summed); a
`RewardGenerator` serialises under `reward_generator` as
`{<reward key>: amount, "repeat": n}`, keeping the per-payout amount and
the repeat separate so the client multiplies.

```json
{ "carats": 660, "gold_crystal_shard": 3,
  "reward_generator": { "gold_crystal_shard": 3, "repeat": 5 } }
```

**Two ways a reward lands on an event:**

- **Inferred policy**, owned by `models/rewards/rules.py` (e.g. story events
  stamp 660 carats + 3 gold shards off-table; Original-debut banners stamp
  carats). New policy is a new function there, not edits to event
  aggregators.

- **Curated data** in `static/*.yaml`. Anchor login bonuses (New Year /
  Golden Week / anniversary) are *known*, not inferred — so they're authored
  directly on the anchor, as a top-level `rewards:` block written in the
  **same shape the client reads** (the bake output above). The bonus is
  identical across regions, so it's a shared field, not per-locale:

  ```yaml
  anchor-golden-week-2021:
    rewards:
      reward_generator:
        carats: 564
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
[`static/yaml/holidays.yaml`](../static/yaml/holidays.yaml) next to `anchor-new-year-*`),
and gathered from the merged store by their `before-`/`during-`/`after-` key
prefix — file location doesn't matter. They never carry an explicit date.
(Authoring crib: [`static/yaml/anchors.txt`](../static/yaml/anchors.txt).)

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

- [data-sources.md](data-sources.md) for which file or scraper each
  fact above is sourced from.
- [prediction.md](prediction.md) for how these rules are (and aren't)
  reflected in predictor logic today.
