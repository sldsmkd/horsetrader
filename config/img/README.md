# `config/img/`

Image assets that are **pipeline input** — read by the ETL during a run, not
just kept for a human to eyeball. That's the line between this directory and
[`references/`](../../references/): anything a loader opens lives here under
`config/`; anything that only exists so a maintainer can check a date stays in
`references/`.

## `misc/`

Shared one-off event images that do not need their own source folder. Files are
addressed by explicit filename from the owning model rather than matched by
ordinal. Current event banners:

- `event-factors.png` → `factorstudies` records.
- `masters-challenge.png` → `masterschallenge` records.
- `racing-carnival.png` → `racingcarnival` records.
- `showtime.png` → `showtime` records.
- `strongest-team.png` → offline last resort for `strongestteam` records. The
  preferred card art comes from each JP post-launch news article because it
  shows the active characters. The official EN “Coming Soon” Akamai asset,
  published as `static/img/misc/dream-team.webp`, is the generic fallback.
- `trainers-skill-test.png` → `skilltest` records.

The bake publishes each as `static/img/misc/<name>.webp` and attaches that URL
to the owning event records as `banner`.

## `stories/`

Story-event banner images, named `story_NN_banner.png` (1-based ordinal, no
zero-pad). Consumed by [`extractors/static/stories.py`](../../horsetrader/extractors/static/stories.py):
`Stories._assign_banners()` date-sorts the story events and pairs them with
these files in ordinal order, then publishes each as `story-NNN-banner.webp`.

When a new story event lands in-game, drop its banner PNG here. **Filename
order must match release order** — the ordinal is what drives the stable-key
match, so a gap or a misnumbered file will misalign every later banner.

For the sourcing workflow, use
[`TN-0004 — Story banner sourcing`](../../docs/trainernet/TN-0004-story-banner-sourcing.md).

See [`docs/etl/data-sources.md`](../../docs/etl/data-sources.md) for the full
data-source picture.
