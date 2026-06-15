# Monthly Data Runbook

Use this when the EN monthly release schedule drops. The job is to archive the
source image, turn confirmed EN dates into curated YAML, bake the bundle, and do
one quick planner sanity check before publishing.

Primary docs:

- `docs/README.md`
- `docs/etl/data-sources.md`
- `docs/etl/architecture.md`
- `docs/contract.md`

## Quick checklist

1. On or around the 1st, look for the new monthly EN release schedule.

2. Pull the latest code and check the worktree.
   ```bash
   git status --short
   ```

3. Save the new EN release schedule image under
   `docs/references/announcements/YYYY_MM.*`.

4. Map every official schedule entry to a stable key. Use Gametora only as an
   ID/ordinal helper when needed, not as the source of truth for confirmed EN
   dates or names.

5. Update curated inputs in `config/yaml/` and any consumed images in
   `config/img/stories/`.

6. Run the full local build.
   ```bash
   make
   ```

7. Run the site checks.
   ```bash
   npm --prefix horsetrader.site run check
   npm --prefix horsetrader.site test
   ```

8. Preview the planner.
   ```bash
   make dev
   ```
   Open `http://localhost:3000`, inspect the newly confirmed month, and stop the
   dev server with `Ctrl-C`.

9. Review generated diffs before committing.
   ```bash
   git diff -- config docs horsetrader.site/js/src/core/bundle static
   git status --short
   ```

## Source Capture

The monthly source of truth is the Cygames EN "Release Schedule" image, usually
posted on the 1st of the month. Treat the 1st as monthly chore day, but don't
panic if the post lands a little late. Archive the image even if only part of it
affects the current model.

- Start with a web search like `umamusume june 2026 schedule`, replacing the
  month/year. The result may be a Reddit mirror, Facebook post, or Twitter/X
  post rather than the original Cygames page.
- Prefer the original official Cygames social post when it is easy to find. If
  the reachable copy is a community repost, archive that image and keep the post
  URL in your notes or commit message.
- Example capture trail: June 2026 was found from
  `https://www.reddit.com/r/UmaMusume/comments/1ttebku/june_2026_global_schedule/`.
- Save normal monthly schedules as `docs/references/announcements/YYYY_MM.jpg`
  or `.png`.
- Verify the saved file exists before moving on:
  ```bash
  ls -l docs/references/announcements/YYYY_MM.*
  ```
- Transcribe the rows from the image into working notes with the displayed UTC
  windows before mapping IDs. This catches OCR/eyeballing mistakes while the
  source image is still open.
- Use a named suffix for special posts, for example
  `YYYY_MM_extra_banners.jpg` or `YYYY_MM_golshi_week.jpg`.
- Do not delete old images after updating YAML. They are the receipt for future
  date/name questions.

Also capture any new story banner art needed by the pipeline:

- Follow `config/img/README.md` for the full story-art sourcing workflow.
- Short version: open `https://umapyoi.net/news?search=story`, save the PNG from
  the story's "Held!" post, not the "starting soon!" teaser, then name it
  `config/img/stories/story_NN_banner.png`.
- `NN` is the 1-based story release ordinal. Use Gametora's Story Event List
  when it has caught up; otherwise use the next integer after the highest
  `story_NN_banner.png` already on disk.
- Keep filename order aligned with story release order; the ETL pairs these by
  ordinal.

Reference-only screenshots that are not modeled today can stay in
`docs/references/`, not `config/`.

## Mapping Stable Keys

Curated YAML uses the project's stable keys, not display names. Use the official
schedule image for confirmed EN dates and names; use Gametora only to identify
stable ids / ordinals when they are not obvious from existing data:

- `banner-30042`: trainee/support gacha banner IDs from Gametora gacha history.
- `story-014`: story event ordinal, zero-padded to 3.
- `cm-014`: Champions Meeting chronological ordinal, zero-padded to 3.
- `legendrace-012`: Legend Race chronological ordinal, zero-padded to 3.
- `scenario-04`: scenario release-order ordinal, zero-padded to 2.
- `anniversary-1_5`: half/full anniversary key.
- `holiday-golden-week-2023` / `holiday-new-year-2023`: holiday anchors.

Before adding an `en:` block, search for the key and nearby predicted entry:

```bash
rg "banner-30042|story-014|cm-014|legendrace-012" config/yaml
```

To map a monthly schedule image against the current predicted bake, inspect the
month's event records:

```bash
jq '.events[] | select(.start >= "2026-06-01" and .start <= "2026-07-05") | {key,type,title,name,start,end,predicted,contents,course,legs}' static/json/events.json
```

Adjust the date bounds for the month. This is the fastest way to turn a generic
image row like "New Trainee and Support Cards!" into the exact `banner-*` keys
and pickup contents already known to the ETL.

If the key is absent because the scraped JP corpus has not reached it yet, run
the bake first and inspect whether the scraper now discovers it. Do not wait on
Gametora for confirmed EN dates: the official schedule image wins. Add curated
YAML once the stable key exists or the loader for that corpus documents a
hand-curated JP row.

## Files To Update

Most monthly work lands in these files:

- `config/yaml/banners.yaml`: confirmed EN gacha banner windows and any
  banner-specific free-pull rewards.
- `config/yaml/stories.yaml`: confirmed EN story windows and official EN story
  names.
- `config/yaml/champions_meetings.yaml`: confirmed EN Champions Meeting
  availability windows.
- `config/yaml/legend_races.yaml`: confirmed EN Legend Race availability
  windows.
- `config/yaml/scenarios.yaml`: confirmed EN scenario names and starts.
- `config/yaml/anniversaries.yaml`: confirmed EN anniversary starts and reward
  stream names/durations.
- `config/yaml/golden_week.yaml` and `config/yaml/new_year.yaml`: holiday
  starts and rewards when the schedule confirms them.
- `config/img/stories/`: consumed story banner PNGs.
- `docs/references/announcements/`: source schedule archive.

Rules of thumb:

- EN content-refresh starts are normally `22:00:00+00:00`.
- Legend Race images may print a 2:59 p.m. UTC close because they come down on
  server reset. Keep using the existing YAML convention unless the legend-race
  loader/model is deliberately changed to track exact close instants.
- Preserve fully qualified ISO timestamps with explicit offsets.
- Keep `en.end` greater than `en.start`.
- Put confirmed dates in `en:` blocks. If an event is still unannounced, leave
  it for prediction.
- Keep comments that explain one-off corrections, renamed events, typo fixes,
  or source-image ambiguity.

## Bake And Validate

Run the full pipeline from the repo root:

```bash
make
```

That runs:

- `make seed`: copies `skeleton/` into `static/`.
- `make bake`: runs `venv/bin/python main.py`, refreshing scrapes as needed,
  writing `static/json/`, `static/img/`, and `config/schema/`.
- `make types`: regenerates committed bundle types in
  `horsetrader.site/js/src/core/bundle/*.gen.ts`.
- `make build`: bundles the planner into `static/`.

If you only need to validate YAML and the bake after a small curation change:

```bash
make seed bake types
```

If you need a fully offline sanity run against the existing cache:

```bash
HORSETRADER_SKIP_CACHE_REFRESH=1 make seed bake types
```

Do not treat the offline run as final for a monthly refresh. The final pass
should be allowed to refresh cache so new Gametora/Umapyoi/Wikiru data can land.

After the bake, check the printed metrics:

- `_predict.unpredicted` should normally stay `0`.
- Newly confirmed events should move from `predicted: true` to
  `predicted: false` in `static/json/events.json`.
- Warnings about missing display names, missing images, or failed matches should
  be investigated before deploy.

## Planner Sanity Check

Run:

```bash
npm --prefix horsetrader.site run check
npm --prefix horsetrader.site test
make dev
```

In the browser, inspect:

- The newly announced month on the timeline.
- Each newly confirmed banner/story/CM/Legend Race date.
- Story banner images for newly added stories.
- Any anniversary or holiday reward streams.
- The first few future predicted events after the confirmed window, to catch
  accidental ordering or date-warp weirdness.

## Diff Review

Expected generated files after `make` may include:

- `static/json/academy.json`
- `static/json/events.json`
- `static/img/**/*.webp`
- `config/schema/*.schema.json`
- `horsetrader.site/js/src/core/bundle/*.gen.ts`
- `static/js/app.js`
- `static/index.html`

Expected hand-edited files are usually limited to:

- `config/yaml/*.yaml`
- `config/img/stories/*.png`
- `docs/references/announcements/*`
- this runbook, when the process changes

Review both sides before committing:

```bash
git diff --stat
git diff -- config/yaml config/img docs/references/announcements
git diff -- static/json config/schema horsetrader.site/js/src/core/bundle
```

## Common Fixes

If the bake fails on a YAML validation error, fix the named key and field. The
static store is intentionally fail-loud for curated data.

If a newly announced banner is not found, confirm the Gametora banner ID and
search the baked or scraped data before inventing a key.

If a story has no banner image, add the next `story_NN_banner.png` under
`config/img/stories/` and rerun `make bake`.

If predictions look strange after adding confirmed dates, compare the new EN
windows against the source image first. A one-day typo in a confirmed event can
pull the predictor chain sideways.

If the cache behaves oddly after a cold rebuild or bulk warm-up, run the jitter
helper once:

```bash
venv/bin/python jitter.py
```

Do not edit `.cache/` by hand.
