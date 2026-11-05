# Debut - timeline image payload audit

Captured 2026-06-19 from the current generated `static/` tree with Pillow.

This audit is intentionally narrow. Disk space and eventual archive/lightbox art
are not the launch concern; the concern is what the timeline card path asks the
browser to fetch while the product is on screen.

## What Counts

Timeline card images come from three places:

- Above-lane trainee/support cards: `record.image`.
- Below-lane rectangular cards: `record.banner`.
- Below-lane mission-shaped cards: `record.image` for `mission`,
  `anniversarymission`, and `scenariomission`.

Large support art, trainee portraits, character portraits, item icons, source
assets, and future lightbox material are out of scope unless they are introduced
onto this path.

## Current Card Payload

Visible timeline card image references:

| Role | Unique files | References | Total | Average | Max | Dimensions |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Above banner art | 349 | 349 | 7.49 MB | 22.0 KB | 28.3 KB | 512x188 |
| Below rectangular banner | 181 | 224 | 9.30 MB | 52.6 KB | 106.1 KB | 936x228 |
| Below mission badge | 194 | 194 | 3.18 MB | 16.8 KB | 19.7 KB | 256x128 |

Total unique image payload on the card path: **19.97 MB**.

Directory split:

| Directory | Files | Size | Average | Max |
| --- | ---: | ---: | ---: | ---: |
| `static/img/banners` | 349 | 7.49 MB | 22.0 KB | 28.3 KB |
| `static/img/misc` | 124 | 5.54 MB | 45.7 KB | 62.2 KB |
| `static/img/stories` | 53 | 3.57 MB | 68.9 KB | 106.1 KB |
| `static/img/missions` | 194 | 3.18 MB | 16.8 KB | 19.7 KB |
| `static/img/holidays` | 4 | 0.20 MB | 50.6 KB | 56.3 KB |

## Read

The above-lane banners are already in a good launch shape. They render around the
timeline card width (`17.5rem`, 280 CSS px at default scale), with some visual
overhang, and ship at 512px wide. The biggest file is only 28.3 KB.

Mission badges are also fine for now. They render as small transparent badge art
and are all 256x128, below 20 KB each. If we revisit them, it belongs with the
Aseprite icon cleanup rather than launch performance.

The only real candidate is below-lane rectangular banner art. Every file is
936x228 and rendered into the same 280 CSS px card width. That source size is
not outrageous because the timeline can zoom and dense displays exist, but story
banners are the heaviest card images today, with several around 100 KB.

Largest below-lane rectangular files:

| File | Size |
| --- | ---: |
| `/img/stories/story-009-banner.webp` | 106.1 KB |
| `/img/stories/story-008-banner.webp` | 105.8 KB |
| `/img/stories/story-011-banner.webp` | 101.0 KB |
| `/img/stories/story-005-banner.webp` | 99.8 KB |
| `/img/stories/story-006-banner.webp` | 99.8 KB |
| `/img/stories/story-014-banner.webp` | 98.9 KB |
| `/img/stories/story-015-banner.webp` | 98.7 KB |

## Resize Estimate

Read-only Pillow estimate against the 40 largest below-lane rectangular banners,
encoded as WebP quality 80:

| Candidate width | Sample size | Saving |
| --- | ---: | ---: |
| 768px | 2.78 MB | 4.5% |
| 640px | 2.08 MB | 28.7% |
| 512px | 1.42 MB | 51.2% |

`768px` is not worth the extra bake complexity. `512px` is attractive for a pure
card-only asset, but may be too tight once zoom and crisp screenshots enter the
picture. `640px` is the sensible first candidate if we decide this needs action.

## Recommendation

Do not remove any hosted art as part of Debut. Keep the future large-art/lightbox
lane open.

For launch, either:

- leave timeline images as-is; the main card-path payload is already modest and
  lazy-loaded, or
- add a dedicated below-card banner derivative at about 640px wide and point
  `record.banner` at that derivative while preserving the larger source for later
  detail views.

The second option is worthwhile only if actual network traces show these banners
arriving early enough to affect first interaction or time-to-first-use. The first
obvious code task is therefore a network pass, not a blind delete pass.

## Related Polish Notes

- Reward icons in `static/icons/*.png` are 256x256 and render at `0.82rem`
  (`/icons/carat.png`, `/icons/trainee_ticket.png`,
  `/icons/support_ticket.png`, `/icons/rainbow_crystal_shard.png`,
  `/icons/gold_crystal_shard.png`). They are 14.7-20.6 KB each, so this is more
  Aseprite polish than performance.
- Club rank badges and character portraits should wait until the identity/report
  shield dimensions are known.
