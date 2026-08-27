# TN-0002 — Marketing tie-ins as holidays

## Status

**Complete — Star Horse 4 and Umayuru proved the path end to end.**

Use this runbook when a JP marketing tie-in proves it transfers to Global with
the same product behaviour as Golden Week or anniversaries: a named campaign
window, optional banner art, and a known shared reward/login stream.

This is not a new event type. Marketing tie-ins bake as `holiday` records keyed
`holiday-marketing-<slug>` and ride the existing holiday reward/projection path.

## Trigger

Star Horse 4 gave the first confirmed proof that this class transfers to Global.
Umayuru then supplied the stronger repeat: the JP and Global sites preserved the
same numeric announcement identities (`860` for Star Horse 4, `994` for
Umayuru), campaign identity, and carat total even though Global compressed the
calendar and localised the presentation.

| Announcement | JP start | Global start | Reward shape |
| --- | --- | --- | --- |
| `813` | 2022-06-10 | 2026-05-28 | 1,500 carats; Global calls it Training Booster Giveaway rather than the JP 15-million-download milestone |
| `860` | 2022-07-20 | 2026-06-25 | Star Horse 4, 150 x 10 = 1,500 carats |
| `994` | 2022-10-17 | 2026-08-26 | Umayuru, 150 x 22 = 3,300 carats |

The two anchor-to-anchor ratios are 28/40 and 62/89: both approximately `0.70`.
That is strong evidence that preserved JP announcement IDs are a useful discovery
index for Global promotional income. It is not permission to book every future
JP promotion as income: reward type and Global timing still need confirmation.

Author the confirmed Global overlay in
[`config/yaml/marketing.yaml`](../../config/yaml/marketing.yaml) once this proof
exists. Before proof, keep similar candidates out of `config/yaml/` or mark them
as JP-only if the JP substrate itself is useful but Global is unconfirmed.

## Identity contract

| Layer | Rule |
| --- | --- |
| Event discriminator | Keep `holiday`; do not add `marketing` to the baked event union. |
| Stable key | Use `holiday-marketing-<slug>`; include the collaboration/product token, e.g. `holiday-marketing-starhorse-4`. |
| Display name | Use the official or clearest campaign name in top-level `name`. |
| Dates | Require `jp.start`; add `en.start` only once Global ships or is officially scheduled. |
| Duration | Put `duration` on JP. EN inherits that span unless Global differs. |
| Rewards | Put confirmed rewards in top-level `rewards:` using the baked reward shape. Use a sparse `sequence` for irregular episode drops; never turn one into a consecutive-day `generator`. |
| Welfare contents | Put distinct granted support cards in top-level `contents:` using `support-*` stable keys. Copy timing/count is source evidence, not currency. |
| Banner | Put the remote announcement thumbnail/header URL in top-level `banner:` when one exists. |

## ETL Implementation

- [x] Add `extractors/static/marketing.py`.
- [x] Select records by `^holiday-marketing-[a-z0-9][a-z0-9-]*$`.
- [x] Validate the same shape as Golden Week: `name`, required `jp`, optional
  `en`, optional `rewards`, optional `banner`, optional `visible`.
- [x] Expose `Static().marketing_holidays()`.
- [x] Include marketing records in `Holidays._fetch_primary()`.
- [x] Process marketing banners into `/img/holidays/<key>-banner.webp`.
- [x] Preserve the existing `holiday` wire record and planner stream.
- [x] Keep `HolidayPredictor` limited to Golden Week and New Year. The preserved
  ID and roughly 0.70 calendar warp make a strong discovery signal, but the
  promotional reward shapes are heterogeneous and Global may rebrand them.

## Authoring Checklist

- [ ] Choose a stable key under `holiday-marketing-*`.
- [ ] Add the JP period and duration from the JP source.
- [ ] Add `rewards:` only for reward streams known to belong to this campaign.
- [ ] For episodic campaigns, copy the confirmed Global payout dates into a
  sparse daily `sequence`; `generator` means consecutive days.
- [ ] Add `banner:` if announcement art is available.
- [ ] Add `en.start` once Global confirms the campaign.
- [ ] If Global changes the run length, add `en.duration`; otherwise let EN
  inherit the JP span.
- [ ] Keep speculative candidates out of `config/yaml/marketing.yaml` until they
  have a useful JP substrate or confirmed EN proof.

Example:

```yaml
holiday-marketing-starhorse-4:
  name: Star Horse 4
  rewards:
    generator:
      free_carats: 150
      repeat: 10
  jp:
    start: 2022-07-20T12:00:00+09:00
    duration: P10D
  en:
    start: 2026-06-25T22:00:00+00:00
  banner: https://prd-info-umamusume.akamaized.net/announce/860/Thumbnail/banner_25300001.png
```

## Umayuru proof

Wikiru labels JP announcement `994` “Umayuru Live Stream Commemoration
Campaign”; Global announcement `994` calls it “A special Umayuru Celebration.”
The `Yuru Paca HAPPY DAYS!` text beside it is the included song, not a Paka Live
campaign name. The login stream opens 22 separate 150-carats claim periods, for
3,300 carats total. In `marketing.yaml` those opening dates are a 120-day sparse
sequence from August 26 through December 23, 2026; the visible event remains
open through December 30.

The campaign also grants five copies of the Power SSR `[Welcome to Umayuru]
Tanino Gimlet` (`support-30145-tanino-gimlet`), on August 26 and 30 and
September 6, 10, and 17. The holiday carries the distinct card in `contents`;
copy count/timing remains campaign evidence rather than a carat resource.

Its Global header is an unusually shallow 936 x 120 strip. The hand-edited
936 x 183 replacement lives at `config/img/holidays/umayaru-login.png`; the
holiday image pass publishes it as the normal
`/img/holidays/holiday-marketing-umayuru-banner.webp` asset.

The reward count and value transfer from JP, but the episode spacing does not.
Because the planner bakes Global only, the top-level sparse sequence records the
confirmed Global payout dates rather than replaying JP's weekly spacing.

This is the second campaign-shaped transfer after Star Horse 4 and the third
preserved-ID promotional correlation including Training Booster Giveaway. It
promotes the old “apologems may track JP marketing” note from suspicion to a
confirmed source-discovery technique, while leaving unrelated giveaway
screenshots unclassified.

### Next watch, not booked

JP announcement `1094` is the 17-million-download gift from December 15, 2022:
1,500 carats. Extending the three confirmed promotional anchors puts its rough
Global landing near October 6, 2026. Treat that as an investigation alarm, not
forecast income—the Global announcement and reward still need to materialise.

## QA

Loader, bake, image, and planner UI were validated for Star Horse 4. Keep the
commands/checks below as the repeatable procedure for each marketing tie-in.

### Loader

```bash
venv/bin/python -c "from horsetrader.extractors.static import Static; print(Static().marketing_holidays())"
```

Confirm the record has:

- `key == "holiday-marketing-starhorse-4"`
- JP period `2022-07-20T12:00:00+09:00` with 10-day span
- EN period `2026-06-25T22:00:00+00:00` with the inherited 10-day span
- `rewards.generator.free_carats == 150` and `repeat == 10`

For Umayuru, also confirm:

- `key == "holiday-marketing-umayuru"`
- JP start `2022-10-17T12:00:00+09:00`
- EN start `2026-08-26T22:00:00+00:00`
- 22 non-null sequence entries, each 150 carats, totalling 3,300
- the final sequence payout is December 23 and the visible window ends
  December 30, 2026

### Bake

```bash
make
```

Then inspect the baked bundle:

```bash
jq '.events[] | select(.key == "holiday-marketing-starhorse-4") |
  {type,key,name,start,end,rewards,banner,predicted}' static/json/events.json
```

Expected:

- `type` is `holiday`.
- `name` is `Star Horse 4`.
- `start` is `2026-06-25T22:00:00+00:00`.
- `end` is 10 days later.
- `predicted` is false when the EN block is present.
- `rewards.generator` carries 150 x 10 free carats.
- `banner` points at `/img/holidays/holiday-marketing-starhorse-4-banner.webp`
  if the remote image processed successfully.

### Planner

- [x] Start the planner and jump to June 25, 2026.
- [x] Confirm Star Horse 4 appears in the below-lane holiday/event card.
- [x] Confirm rewards are counted by the existing Holidays play-style toggle.
- [x] Toggle Holidays off/on and confirm the ledger delta matches 1,500 carats.
- [x] Confirm no new planner type generation is needed; this is still a
  `HolidayRecord`.

## Completion Criteria

- [x] The ETL bake emits the marketing campaign as a confirmed `holiday`.
- [x] The banner appears in `static/json/images.json` when processed.
- [x] Planner reward projection treats the event exactly like other holidays.
- [x] This runbook and `docs/etl/data-sources.md` match the live code.
