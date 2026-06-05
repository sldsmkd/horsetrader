# Issue #18 report draft: anniversary missions vs anniversary anchors

Scope: ETL-side evidence only, using the current baked event output in `static/json/events.json`, the curated anniversary anchor source in `config/yaml/anniversaries.yaml`, and the older import notes in `docs/references/import/login_bonus.yaml` where relevant.

Method:
- Treat `anchor-anni-*` as the anniversary beat.
- Attach chained `anchoredevent` rows that point at that anchor.
- Attach `mission` rows whose names explicitly identify the same anniversary beat.
- Compare date overlap and reward payloads, with `sequence.free_carats` summed separately from any lump-sum `free_carats`.

Bottom line:
- Temporal overlap is real: anniversary missions are intentionally scheduled around the same beat as anniversary anchors.
- In the current bake, only the `1.5` anniversary has both anniversary missions and a curated anchor-attached reward campaign on the same beat.
- That `1.5` reward data is not a literal duplicate stream: the mission rows carry `500` free carats each, while the anchored celebration row carries `3000` lump-sum free carats plus a `1500` carat login-style sequence.
- For `0.5`, `2.5`, `3.5`, and `4.5`, the bake has anniversary mission rewards but no anchor-attached reward payload on the same beat.
- For `1.0`, `2.0`, `3.0`, `4.0`, and `5.0`, the bake currently has an anniversary anchor but no anniversary mission rows attached yet.

## 0.5 anniversary

Observed overlap set in the bake:

| Key | Type | Name | Start | End | Rewards |
| --- | --- | --- | --- | --- | --- |
| `mission-00100` | mission | Half Anniversary Celebration Missions Part 1 | 2025-10-26 | 2025-12-10 | `free_carats: 500`, `trainee_tickets: 3` |
| `anchor-anni-0_5` | anchor | — | 2025-11-03 | 2025-11-03 | none |
| `mission-00101` | mission | Half Anniversary Celebration Missions Part 2 | 2025-11-03 | 2025-12-10 | `free_carats: 500` |
| `mission-00102` | mission | Half Anniversary Celebration Missions Part 3 | 2025-11-06 | 2025-12-10 | `free_carats: 500` |

Assessment: same beat, but there is no curated anniversary reward event here to collide with the mission carats.

## 1.0 anniversary

Observed overlap set in the bake:

| Key | Type | Name | Start | End | Rewards |
| --- | --- | --- | --- | --- | --- |
| `anchor-anni-1_0` | anchor | — | 2026-03-12 | 2026-03-12 | none |

Supplemental import note only:
- `docs/references/import/login_bonus.yaml` records three JP-side `1st Anniversary Celebration Missions` entries with combined mission-plus-login totals (`2000`, `3500`, `2700` free carats respectively), but those are not present as current baked anniversary event rows.

Assessment: no baked mission/anchor reward overlap to count today.

## 1.5 anniversary

Curated source note:
- `config/yaml/anniversaries.yaml` defines `anchor-anni-1_5`, then a chained celebration row for Part 2 with `free_carats: 3000` plus a `sequence` of twelve `150` carat legs, then a chained Part 3 row with no explicit rewards.

Observed overlap set in the bake:

| Key | Type | Name | Start | End | Rewards |
| --- | --- | --- | --- | --- | --- |
| `mission-00217` | mission | 1.5th Anniversary 記念ミッション 第1弾 | 2026-07-12 | 2026-08-26 | `free_carats: 500`, `support_tickets: 2`, `trainee_tickets: 2` |
| `anchor-anni-1_5` | anchor | — | 2026-07-20 | 2026-07-20 | none |
| `after-anni-1_5` | anchoredevent | 1.5th Anniversary Celebration Part 2 | 2026-07-20 | 2026-08-17 | `free_carats: 3000`, `sequence_free_carats: 1500` |
| `mission-00218` | mission | 1.5th Anniversary 記念ミッション 第2弾 | 2026-07-20 | 2026-08-26 | `free_carats: 500`, `gold_crystal_shards: 1`, `rainbow_crystal_shards: 1` |
| `after-anni-1_5p2` | anchoredevent | 1.5th Anniversary Celebration Part 3 | 2026-08-17 | 2026-09-14 | none |

Assessment:
- This is the only anniversary in the current bake where anniversary missions and a curated anniversary reward campaign coexist on the same beat.
- The free-carat streams are disjoint in amount and structure.
- There is no evidence here of the same `500`-carat mission payout also being represented inside the curated `3000 + 1500 sequence` campaign row.

## 2.0 anniversary

Observed overlap set in the bake:

| Key | Type | Name | Start | End | Rewards |
| --- | --- | --- | --- | --- | --- |
| `anchor-anni-2_0` | anchor | — | 2026-11-23 | 2026-11-23 | none |

Assessment: no baked mission/anchor reward overlap to count today.

## 2.5 anniversary

Observed overlap set in the bake:

| Key | Type | Name | Start | End | Rewards |
| --- | --- | --- | --- | --- | --- |
| `mission-00372` | mission | 2.5th Anniversary 記念ミッション 第1弾 | 2027-03-22 | 2027-05-08 | `free_carats: 500`, `trainee_tickets: 1`, `support_tickets: 1` |
| `anchor-anni-2_5` | anchor | — | 2027-04-01 | 2027-04-01 | none |
| `mission-00373` | mission | 2.5th Anniversary 記念ミッション 第2弾 | 2027-04-01 | 2027-05-08 | `free_carats: 500`, `gold_crystal_shards: 1`, `rainbow_crystal_shards: 1`, `trainee_tickets: 1`, `support_tickets: 1` |
| `mission-00374` | mission | 2.5th Anniversary 記念ミッション 第3弾 | 2027-04-12 | 2027-05-08 | `free_carats: 500`, `gold_crystal_shards: 1`, `trainee_tickets: 1`, `support_tickets: 1` |

Assessment: missions overlap the anchor window, but the anchor carries no reward payload in the bake.

## 3.0 anniversary

Observed overlap set in the bake:

| Key | Type | Name | Start | End | Rewards |
| --- | --- | --- | --- | --- | --- |
| `anchor-anni-3_0` | anchor | — | 2027-08-09 | 2027-08-09 | none |

Assessment: no baked mission/anchor reward overlap to count today.

## 3.5 anniversary

Observed overlap set in the bake:

| Key | Type | Name | Start | End | Rewards |
| --- | --- | --- | --- | --- | --- |
| `mission-00675` | mission | 3.5th Anniversary 記念ミッション 第1弾 | 2027-12-03 | 2028-01-20 | `free_carats: 500`, `trainee_tickets: 1`, `support_tickets: 1` |
| `anchor-anni-3_5` | anchor | — | 2027-12-13 | 2027-12-13 | none |
| `mission-00676` | mission | 3.5th Anniversary 記念ミッション 第2弾 | 2027-12-13 | 2028-01-20 | `free_carats: 500`, `gold_crystal_shards: 1`, `rainbow_crystal_shards: 1`, `trainee_tickets: 1`, `support_tickets: 1` |
| `mission-00677` | mission | 3.5th Anniversary 記念ミッション 第3弾 | 2027-12-30 | 2028-01-20 | `free_carats: 500`, `gold_crystal_shards: 1`, `trainee_tickets: 1`, `support_tickets: 1` |

Assessment: missions overlap the anchor window, but the anchor carries no reward payload in the bake.

## 4.0 anniversary

Observed overlap set in the bake:

| Key | Type | Name | Start | End | Rewards |
| --- | --- | --- | --- | --- | --- |
| `anchor-anni-4_0` | anchor | — | 2028-04-20 | 2028-04-20 | none |

Assessment: no baked mission/anchor reward overlap to count today.

## 4.5 anniversary

Observed overlap set in the bake:

| Key | Type | Name | Start | End | Rewards |
| --- | --- | --- | --- | --- | --- |
| `mission-00864` | mission | 4.5th Anniversary 記念ミッション 第1弾 | 2028-08-18 | 2028-10-04 | `free_carats: 500`, `trainee_tickets: 1`, `support_tickets: 1` |
| `anchor-anni-4_5` | anchor | — | 2028-08-28 | 2028-08-28 | none |
| `mission-00865` | mission | 4.5th Anniversary 記念ミッション 第2弾 | 2028-08-28 | 2028-10-04 | `free_carats: 500`, `gold_crystal_shards: 1`, `rainbow_crystal_shards: 1`, `trainee_tickets: 1`, `support_tickets: 1` |
| `mission-00866` | mission | 4.5th Anniversary 記念ミッション 第3弾 | 2028-09-13 | 2028-10-04 | `free_carats: 500`, `gold_crystal_shards: 1`, `trainee_tickets: 1`, `support_tickets: 1` |

Assessment: missions overlap the anchor window, but the anchor carries no reward payload in the bake.

## 5.0 anniversary

Observed overlap set in the bake:

| Key | Type | Name | Start | End | Rewards |
| --- | --- | --- | --- | --- | --- |
| `anchor-anni-5_0` | anchor | — | 2029-01-04 | 2029-01-04 | none |

Assessment: no baked mission/anchor reward overlap to count today.

## Comment-ready conclusion

Issue #18 draft answer:

> I checked the anniversary mission rows against the anniversary anchors in the current bake.
>
> Temporal overlap is intentional and real: the anniversary missions are scheduled around the same `anchor-anni-*` beats.
>
> Reward-stream overlap is much narrower. In the current baked model, only the `1.5th` anniversary has both anniversary missions and a curated anchor-attached anniversary reward event on the same beat. Those payloads are not literal duplicates: `mission-00217` and `mission-00218` each carry `500` free carats, while the chained curated event `after-anni-1_5` carries a separate `3000` lump-sum free-carat block plus a `1500` carat sequence. I do not see evidence that the same carat stream is being counted twice there.
>
> For `0.5`, `2.5`, `3.5`, and `4.5`, the anniversary missions exist and overlap the anniversary anchor by date, but the anchor side has no reward payload in the bake. For `1.0`, `2.0`, `3.0`, `4.0`, and `5.0`, the bake currently only has the anniversary anchor.
>
> So the answer from the current model output is: no clear carat double-count is present in the baked anniversary reward streams, but the `1.5th` anniversary is the place that looks most confusing because it keeps both mission rows and a separate anchored celebration reward row alive on the same beat.