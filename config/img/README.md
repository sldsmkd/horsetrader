# `static/img/`

Image assets that are **pipeline input** — read by the ETL during a run, not
just kept for a human to eyeball. That's the line between this directory and
[`references/`](../../references/): anything a loader opens lives here under
`static/`; anything that only exists so a maintainer can check a date stays in
`references/`.

## `misc/`

Shared one-off event images that do not need their own source folder. Files are
addressed by explicit filename from the owning model rather than matched by
ordinal. Current event banners:

- `event-factors.png` → `factorstudies` records.
- `masters-challenge.png` → `masterschallenge` records.
- `racing-carnival.png` → `racingcarnival` records.
- `showtime.png` → `showtime` records.
- `strongest-team.png` → `strongestteam` records.
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

### Sourcing a new banner

1. Open <https://umapyoi.net/news?search=story>. Each story event produces two
   posts: a *"…starting soon!"* teaser (closet/announcement art) and a
   *"…Held!"* post once it goes live. **Save the PNG from the "Held!" post** —
   that one consistently carries the final in-game art; the teaser doesn't.
2. Find the ordinal by correlating the event against gametora's
   [Story Event List](https://gametora.com/umamusume/events/story-events).
   Count from the bottom (oldest) up; the new event is the next integer after
   the current highest `story_NN_banner.png` on disk.
3. Save as `story_NN_banner.png` (no zero-pad).

Caveat: gametora often lags the live JP server by an event or two, so the very
newest event may not appear in its list yet. When that happens it *is* the
newest — assign it the next ordinal after the highest file already here.

See [`docs/data-sources.md`](../../docs/data-sources.md) for the full picture.
