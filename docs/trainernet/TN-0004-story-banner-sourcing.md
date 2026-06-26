# TN-0004 — Story banner sourcing

## Status

**Standing runbook — use when a new story event needs consumed banner art.**

Use this when the ETL has, or is about to have, a new story event whose banner
PNG must be added under `config/img/stories/`.

Story banners are pipeline input. The ETL pairs files by release ordinal, so the
important thing is to source the final in-game art and give it the next correct
`story_NN_banner.png` filename.

## Procedure

1. Open <https://umapyoi.net/news?search=story>.
2. Find the story event's live post. Each story usually has two posts:
   `"starting soon!"` uses teaser/announcement art, while `"Held!"` carries the
   final in-game banner.
3. Save the PNG from the `"Held!"` post.
4. Find the story ordinal by correlating the event against Gametora's
   [Story Event List](https://gametora.com/umamusume/events/story-events).
   Count release order from oldest to newest.
5. If Gametora has not caught up to the live JP server yet, treat the live event
   as the newest story and use the next integer after the highest
   `story_NN_banner.png` already on disk.
6. Save the file as `config/img/stories/story_NN_banner.png`, with `NN` as a
   1-based integer and no zero-padding requirement.
7. Run the bake and confirm the story gets `/img/stories/story-NNN-banner.webp`
   in `static/json/events.json`.

## Checks

```bash
ls config/img/stories/story_*_banner.png
```

Confirm there are no ordinal gaps or accidental duplicates. A misnumbered file
will misalign every later story banner because
[`Stories._assign_banners()`](../../horsetrader/models/events/story.py) pairs
story events with image files by sorted release order.

```bash
jq '.events[] | select(.type == "story") |
  {key,title,start,banner}' static/json/events.json
```

Confirm the newly added story points at the expected generated WebP.
