# Skills

This page maps the part of Global `master.mdb` used by
[`UmamusumeSkills`](../../horsetrader/extractors/umamusume/skills.py). Counts are
for the snapshot identified in [`catalog.md`](catalog.md).

## Confirmed extraction

`skill_data` contains 705 rows, keyed by `id`. Every one of those IDs has both a
Global English name and description in `text_data`:

| Meaning | Join |
| --- | --- |
| Skill name | `text_data.category = 47 AND text_data.index = skill_data.id` |
| Skill description | `text_data.category = 48 AND text_data.index = skill_data.id` |

Each text category contains 1,122 distinct indexes. The 705 current
`skill_data.id` values have complete coverage; the other 417 text indexes in
each category do not have a `skill_data` row in this snapshot. Consequently,
`skill_data` drives extraction and `text_data` enriches it—not the reverse.

`text_data` has a composite primary key of `(category, index)`. Its standalone
`id` column is not a key and must not be used for this join.

## Worked example: Operation Cacao

The Valentine's Mihono Bourbon card gives us an end-to-end fixture:

```text
chara_data 1026 (Mihono Bourbon)
└── card_data 102602 ([CODE: ICING], variant 02)
    ├── card_rarity_data 10260203 → skill_set 11260103 → skill 110261 level 1
    ├── card_rarity_data 10260204 → skill_set 11260104 → skill 110261 level 2
    └── card_rarity_data 10260205 → skill_set 11260105 → skill 110261 level 3
```

The unique skill row and its Global text are:

| Client field | Raw value | Established display meaning |
| --- | --- | --- |
| `skill_data.id` | `110261` | Operation Cacao |
| `rarity` | `5` | Client skill class used for this unique skill; not the card's three-star rarity |
| `skill_category` | `5` | Unique-skill family |
| `group_id`, `group_rate` | `11026`, `1` | Group identity/rank; exact semantics remain provisional |
| `condition_1` | `order<=4&phase==1&corner!=0&bashin_diff_behind<=3` | The complete condition shown by Gametora |
| `float_ability_time_1` | `50000` | 5 seconds, indicating a 10,000 scale |
| `ability_type_1_1` | `27` | Increase target speed in this example |
| `float_ability_value_1_1` | `3500` | `0.35` after the same 10,000 scale |
| `ability_type_1_2` | `9` | Stamina recovery in this example |
| `float_ability_value_1_2` | `150` | `0.015` after the same 10,000 scale |
| `icon_id` | `20013` | Unique-version skill icon identity |

The exact in-game description is already category 48 text. Gametora's detailed
description—mid-race corner, runner immediately behind, speed plus recovery—is a
human-readable interpretation of the condition and effect fields, not another
text row we need to scrape. That is precisely the unbundling opportunity: once
the condition language, ability enum, and scaling are mapped, the client row can
produce the detailed explanation directly.

`available_skill_set_id = 102602` contains seven ordinary learnable skills for
this trainee; it does not contain Operation Cacao. The unique skill instead
arrives through each rarity row's `skill_set`, as shown above.

## Unique and inherited forms

`skill_category = 5` contains both original Unique skills and their inherited
Normal forms. The relationship is explicit in the inherited row rather than
derived from the shared name:

| Population | Rows | Physical signature |
| --- | ---: | --- |
| Original Unique | 117 | `skill_category = 5`, `rarity IN (3, 4, 5)`, no `unique_skill_id_*` reference |
| Inherited Normal | 96 | `skill_category = 5`, `rarity = 1`, `unique_skill_id_1 != 0` |

All 96 inherited rows have `activate_lot = 1` and `is_general_skill = 1`, matching
Gametora's “With check” and Normal presentation. Every `unique_skill_id_1`
references an original Unique row. Seventeen inherited rows also populate
`unique_skill_id_2`, allowing one inherited form to represent a second original
Unique version. Those 113 referenced targets are all category 5 and rarity 3–5.

Operation Cacao's inherited form is `skill_data.id = 910261`:

| Field | Original `110261` | Inherited `910261` |
| --- | ---: | ---: |
| `rarity` | 5 | 1 |
| `unique_skill_id_1` | 0 | `110261` |
| `activate_lot` | 0 | 1 |
| `is_general_skill` | 0 | 1 |
| `float_ability_time_1` | 50,000 (5 s) | 30,000 (3 s) |
| `float_ability_value_1_1` | 3,500 (`0.35`) | 1,500 (`0.15`) |
| `float_ability_value_1_2` | 150 (`0.015`) | 35 (`0.0035`) |
| `icon_id` | `20013` | `20011` |

Its base cost is not stored in `skill_data`:
`single_mode_skill_need_point(id = 910261).need_skill_point = 200`. All 96
inherited rows have a matching cost row and their own category 47/48 name and
description. Operation Cacao's inherited description says “minimal breather” and
“slightly increase velocity,” so this text also comes directly from the Global
client.

The original's `icon_id = 20013` agrees with Gametora's
[`20013.png`](https://media.gametora.com/umamusume/skills/icon/20013.png). The
numeric mapping is confirmed; locating and decoding the corresponding official
client asset through `meta` remains separate asset-catalog work.

## Rare/Gold skills and trainee availability

Gametora presents client rarity 2 as Rare—the gold-framed skill tier. Unlike an
inherited Unique skill, its weaker Normal version is not linked through
`unique_skill_id_*`. The two rows share a `group_id`, and `group_rate` orders the
versions.

Encroaching Shadow is the concrete pair:

| Field | Gold `200641` | Normal `200642` |
| --- | ---: | ---: |
| `rarity` | 2 | 1 |
| `group_id` | `20064` | `20064` |
| `group_rate` | 2 | 1 |
| `condition_1` | `running_style==4&is_lastspurt==1&corner==0` | same |
| `float_ability_time_1` | 9,000 (`0.9 s`) | 9,000 (`0.9 s`) |
| `ability_type_1_1` | 31 (acceleration) | 31 (acceleration) |
| `float_ability_value_1_1` | 4,000 (`0.4`) | 2,000 (`0.2`) |
| `icon_id` | `20042` | `20041` |
| `single_mode_skill_need_point.need_skill_point` | 180 | 180 |

Native trainee availability is a card relationship:

```text
skill_data 200641 (Encroaching Shadow)
└── available_skill_set(skill_id=200641, need_rank=5)
    └── available_skill_set_id 105001
        └── card_data 105001 ([Nevertheless] Narita Taishin)
            └── chara_id 1050 (Narita Taishin)
```

That is the only current `available_skill_set` row for the Gold skill. Three
other trainee cards—Tamamo Cross `102101`, Inari One `103401`, and Sweep Tosho
`104401`—carry only Normal `200642`, as does the same Narita Taishin card at rank
2. Narita Taishin's second current card, `105002`, has neither member of this
pair. “Available on Narita Taishin” is therefore a useful character-level
projection over version-specific `card_data`, not a direct skill-to-character
edge.

Global `text_data` already stages category 4/5 names for Inari One card `103402`,
`[Golden Dream] Inari One`, which is the festival variant expected to gain
Encroaching Shadow. The current snapshot has no corresponding `card_data`,
`card_rarity_data`, or `available_skill_set` row, however. Its skill grant cannot
yet be established from this client. This is another reason entity tables drive
extraction: localized text can arrive before playable content and its
relationships.

### Acquisition channels

Straightaway Spurt demonstrates why a skill needs source records rather than a
single `characters` field. Gametora displays four distinct card-based channels,
and scenario rewards add a fifth source type:

| Channel | Client relationship | Straightaway Spurt coverage |
| --- | --- | ---: |
| Trainee-native | `card_data.available_skill_set_id` → `available_skill_set` | 4 cards |
| Trainee event | Story/event reward data | 3 characters shown by Gametora; client path not yet mapped |
| Support hint | `support_card_data.skill_set_id` → `single_mode_hint_gain.hint_id` | 8 support cards |
| Support event | Story/event reward data | 2 supports shown by Gametora; client path not yet mapped |
| Scenario reward | Scenario story/reward data | Not applicable to Straightaway Spurt; see No Stopping Me! below |

The four native trainee records are exact:

| Card | Trainee | `need_rank` |
| ---: | --- | ---: |
| `102101` | `[Fast as Lightning] Tamamo Cross` | 4 |
| `103401` | `[Edomurasaki] Inari One` | 4 |
| `104401` | `[Platanus Witch] Sweep Tosho` | 4 |
| `105001` | `[Nevertheless] Narita Taishin` | 2 |

For support hints, `support_card_id` selects the rows for the specific support
card. When `hint_gain_type = 0`, `hint_value_1` is a verified `skill_data.id`.
Straightaway Spurt has these eight rows:

| Support rarity | Support card |
| --- | --- |
| SSR (`3`) | `30004` `[Breakaway Battleship] Gold Ship` |
| SSR (`3`) | `30057` `[That Time I Became the Strongest] Gold Ship` |
| SSR (`3`) | `30092` `[Mag!c Number] Air Shakur` |
| SSR (`3`) | `30097` `[Dear Mr. C.B.] Mr. C.B.` |
| SR (`2`) | `20003` `[Reach the Top!] Hishi Amazon` |
| R (`1`) | `10006` `[Tracen Academy] Gold Ship` |
| R (`1`) | `10024` `[Tracen Academy] Hishi Amazon` |
| R (`1`) | `10078` `[Tracen Academy] Mr. C.B.` |

Across the snapshot, all 1,412 type-0 hint rows match `skill_data.id`, covering
172 skills across 223 support cards. They all point to rarity-1 skills.

The two event channels are not represented by `available_skill_set` or the
standard support hint rows. They likely live in story/event reward data outside
these relational edges and remain deliberately unmapped. This also applies to
Gold skills awarded by SSR support-card events: they must not be collapsed into
native trainee availability or ordinary hint availability.

### Scenario rewards: No Stopping Me!

No Stopping Me! establishes that a scenario itself can grant a skill. Gametora
attributes it to Unity Cup, whose client identity is explicit:

```text
single_mode_scenario.id = 2
text_data(category = 119, index = 2)
    = Unity Cup: Shine On, Team Spirit!
```

Its Gold and Normal mechanics form the usual shared-group pair:

| Field | Gold `200491` No Stopping Me! | Normal `200492` Nimble Navigator |
| --- | ---: | ---: |
| `rarity` | 2 | 1 |
| `group_id`, `group_rate` | `20049`, `2` | `20049`, `1` |
| `condition_1` | `infront_near_lane_time>=1&is_lastspurt==1&hp_per>=1` | same |
| `float_ability_time_1` | 30,000 (`3 s`) | 30,000 (`3 s`) |
| `float_cooldown_time_1` | 300,000 (`30 s`) | 300,000 (`30 s`) |
| `ability_type_1_1` | 31 (acceleration) | 31 (acceleration) |
| `float_ability_value_1_1` | 4,000 (`0.4`) | 2,000 (`0.2`) |
| `ability_type_1_2` | 28 (lane movement speed) | 28 (lane movement speed) |
| `float_ability_value_1_2` | 250 (`0.025`) | 50 (`0.005`) |
| `single_mode_skill_need_point.need_skill_point` | 150 | 150 |
| `icon_id` | `20042` | `20041` |

The four characters Gametora displays for the Gold skill are independently
present as native trainee-card relationships:

| Card | Trainee | `need_rank` |
| ---: | --- | ---: |
| `102401` | `[Scramble☆Zone] Mayano Top Gun` | 5 |
| `102901` | `[Darl'n Snowflake] Yukino Bijin` | 3 |
| `103901` | `[Princess of Pink] Kawakami Princess` | 3 |
| `106002` | `[Run & Win] Nice Nature` | 5 |

The scenario attribution is not such a relationship. There is no row joining
`single_mode_scenario.id = 2` to `skill_data.id = 200491`, and the exact skill
ID does not occur in the scenario, Aoharu, scenario-record, or generic reward
tables. `single_mode_story_data` identifies story entries but carries no reward
columns. The current master therefore proves both endpoints—the scenario and
the skill—but not their acquisition edge. That edge is probably encoded in
scenario event/script assets, which still need mapping.

An extracted source model should consequently represent at least these five
types independently: trainee-native, trainee-event, support-hint,
support-event, and scenario-reward. A scenario reward must not be inferred from
the skill's native characters or folded into a generic card event.

## `skill_data` shape

The table has 78 non-null columns. Its repeated fields encode up to two
activation blocks, with up to three effects in each block:

```text
skill_data
├── identity and grouping
│   ├── id, rarity, group_id, group_rate, skill_category, tag_id
│   └── unique_skill_id_1, unique_skill_id_2
├── activation block 1
│   ├── precondition_1, condition_1, float_ability_time_1
│   ├── float_cooldown_time_1, ability_time_usage_1
│   └── effect slots ability_type_1_1 ... ability_type_1_3
├── activation block 2
│   ├── precondition_2, condition_2, float_ability_time_2
│   ├── float_cooldown_time_2, ability_time_usage_2
│   └── effect slots ability_type_2_1 ... ability_type_2_3
└── display, availability, and lifecycle fields
    ├── disp_order, icon_id, plate_type, is_general_skill
    └── disable_singlemode, start_date, end_date
```

Each effect slot repeats `ability_type`, `ability_value_usage`,
`additional_activate_type`, `ability_value_level_usage`,
`float_ability_value`, `target_type`, and `target_value`. The `float_` prefix is
the client's storage vocabulary: these columns are physically SQLite integers.
Their scaling and enum meanings are not yet documented.

`unique_skill_id_1` and `_2` are the inherited-to-original relationships mapped
above. `group_id` is not a self-reference; only one of its 705 values happens to
match a skill ID. Treat it as a grouping namespace until its behavior is mapped.

## Sets and progression

| Table | Rows | Observed role and coverage |
| --- | ---: | --- |
| `skill_set` | 1,443 | Fixed-width sets of 20 `(skill_id, skill_level)` slots. All 5,193 nonzero skill slots match `skill_data.id`. |
| `available_skill_set` | 672 | Groups skill availability by `available_skill_set_id`, with `need_rank`. All rows match `skill_data.id`; 96 sets cover 260 distinct skills. |
| `skill_exp` | 10 | Level scaling by `type`, `level`, and `scale`; no per-skill ID. |
| `skill_level_value` | 261 | Coefficients by `ability_type` and level; no per-skill ID. |
| `skill_upgrade_condition` | 0 | Physical schema exists, but Global supplies no rows in this snapshot. |
| `skill_upgrade_description` | 0 | Physical schema exists, but Global supplies no rows in this snapshot. |

Several consumers have fully matching observed relationships:

- `card_data.available_skill_set_id` → `available_skill_set.available_skill_set_id`
  for all 96 nonzero card values.
- `card_rarity_data.skill_set` → `skill_set.id` for all 313 nonzero values.
- `single_mode_npc.skill_set_id` → `skill_set.id` for all 1,518 nonzero values.
- `legend_race_npc.skill_set_id` → `skill_set.id` for all 715 nonzero values.

`support_card_data.skill_set_id` deliberately does not match `skill_set.id`; its
support-hint relationship is documented above. Of 238 support cards, 226 have
some matching `single_mode_hint_gain` entry and 223 have a type-0 skill hint.

## Extractor boundary

The spike deliberately returns the complete `skill_data` row plus `name_en`,
`description_en`, `key = skill-<id>`, and a Cygames correlation. It does not yet
translate condition expressions, ability/target enums, integer scaling, set
membership, or progression values into a Horsetrader domain model.

That lossless boundary lets schema work proceed independently of Gametora while
we establish those meanings from client evidence.
