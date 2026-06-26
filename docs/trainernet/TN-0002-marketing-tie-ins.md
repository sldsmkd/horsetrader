# TN-0002 — Marketing tie-ins as holidays

## Status

**Complete — Star Horse 4 proved the path end to end on June 26, 2026.**

Use this runbook when a JP marketing tie-in proves it transfers to Global with
the same product behaviour as Golden Week or anniversaries: a named campaign
window, optional banner art, and a known shared reward/login stream.

This is not a new event type. Marketing tie-ins bake as `holiday` records keyed
`holiday-marketing-<slug>` and ride the existing holiday reward/projection path.

## Trigger

Star Horse 4 gave the first confirmed proof that this class transfers to Global.
The JP campaign ran as a 10-day marketing login/reward event from July 20, 2022.
Global began the matching campaign on June 25, 2026 at 22:00 UTC, with the same
150-carats-per-day x 10 reward shape.

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
| Rewards | Put shared rewards in top-level `rewards:` using the baked reward shape. |
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
- [x] Keep `HolidayPredictor` limited to Golden Week and New Year until there is
  enough repeat evidence for a marketing cadence.

## Authoring Checklist

- [ ] Choose a stable key under `holiday-marketing-*`.
- [ ] Add the JP period and duration from the JP source.
- [ ] Add `rewards:` only for reward streams known to belong to this campaign.
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

## QA

For the Star Horse 4 proof case, loader, bake, image, and planner UI were all
validated. Keep the commands/checks below as the repeatable procedure for the
next marketing tie-in.

### Loader

```bash
venv/bin/python -c "from horsetrader.extractors.static import Static; print(Static().marketing_holidays())"
```

Confirm the record has:

- `key == "holiday-marketing-starhorse-4"`
- JP period `2022-07-20T12:00:00+09:00` with 10-day span
- EN period `2026-06-25T22:00:00+00:00` with the inherited 10-day span
- `rewards.generator.free_carats == 150` and `repeat == 10`

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
