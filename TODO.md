

---

## ✅ Favourites bar — atom cards + cyclic navigation

~~- Show a counter: how many times the character still appears ahead in the timeline
- When count reaches zero: grey out the entry + show a remove (×) button
- Click jumps to the nearest upcoming occurrence ahead of the current timeline position
- If no occurrences remain ahead, wrap back to the first (earliest) one~~

Done: the bar is now the Favourites surface. It renders one widget per favourited
atom (image, name, rarity/subtext, next target date, appearance count), keeps
open banners until their end date, and taps cycle to the next appearance after
the current view centre, wrapping to the first available appearance. The minimap
and Favourites surface share the same future/open favourite-appearance selector.

The explicit "expired favourite with remove button" state is deferred for now:
fully elapsed favourites simply leave the navigation list, and the empty surface
stays expandable with discovery copy.

## ✅ Favourites bar — planner flip

~~The bar has two faces (flip toggle, like a standing mirror reversed):

- **Favourites face** — starred characters/cards (as above)
- **Planner face** — banners you've committed to, each showing the pity count on that commitment
- Flipping is a single UI toggle; both faces share the same bar slot/position in the layout~~

Done: the bar now flips between Favourites and Planner. The Planner face lists
open/future committed banners, shows banner art and pickup atoms, warps to the
banner on tap, makes the committed pity count the bottom-right badge, and reuses
the real banner atom chips so favourited pickups and support stats are visible
in the plan list too.

## Favourites / Plan surface polish

Functionally solid; sleep on these rather than forcing them now:

- ~~Tighten spacing and density on the Plan face now that it uses full atom chips~~ →
  Done: Plan rows reworked to favourites-row height; the full atom chips were
  dropped entirely in favour of full-strength banner art (the art is the
  recognisable signal — what people are pulling for). Fixed date column +
  `box-sizing: border-box` killed a horizontal overflow (card was rendering
  ~1.4rem wider than the panel under the project's default content-box).
- Revisit drawer colour/contrast after using it in a real planning session
- Decide whether the expanded Favourites/Plan surface needs stronger visual identity
- Add an explicit expired-favourite state with a remove control if silent culling feels too hidden

## ✅ Minimap bookmark/commit dots

~~Replace the current dot marks with two distinct glyphs keyed on the banner's state:

- **□ empty square** — banner contains a favourited character or card (bookmarked via content)
- **■ filled square** — banner has a commitment on it

Both can coexist if a committed banner also contains other favourites.~~

Done: minimap markers now show empty bookmark squares and filled commit squares on fixed trainee/support rows; commitment wins when both states apply.

## ✅ Minimap above-the-line colour

~~- Blue only when the projection at that point is **positive** (above threshold)
- Explore a configurable threshold cutover: 0 pity, 1 pity, etc. — below threshold flips to red even if still above the lane
- Below-the-lane area is always red regardless~~

Done: minimap bands are binary around the origin fret — blue above origin when positive, red below origin when negative; semantic colours live in the shared palette.

## ✅ Card styling — fixed width pass

~~Establish a consistent fixed width across all card types as the first styling pass. No card should be sized by its content.~~

Done: timeline cards now share a fixed 280px width token, and below-card bodies stretch to that width so small events carry equal visual weight.

## ✅ Card colour flashes

~~Restore the left-edge colour flashes that distinguish card types (supports vs trainees). These were present before and help at a glance without reading.~~

Done: restored support/trainee banner flashes and introduced shared CSS palette tokens so card/favourite colours have one source of truth.

## ✅ Grouped banner layout — max 2 rows

~~When a concurrent group contains more than 2 banners, widen the group column into a grid rather than stacking deeper. Maximum depth is 2 rows; overflow goes into additional columns.~~

Done: banner groups now use internal trainee/support lanes, keeping trainees on the top sightline and supports below while overflowing horizontally into additional columns.

## ✅ Banner card — rate-up scroll area

~~When the rate-up character list overflows the card height, show a scroll area rather than clipping or expanding the card.~~

Done: banner chip lists now wrap naturally and become internal scroll areas only when they overflow; only overflowing lists opt back into pointer handling so timeline panning stays intact.

## ✅ Banner rate-up sort order

~~Sort rate-up characters consistently: crystal (high priority / featured) first, gold below, alpha-sorted within each tier group.~~

Done: banner atoms are sorted crystal → gold → silver, then alphanumeric by display name within each rarity bucket.

## Favourites icon — star fruit

Design and wire in a custom star fruit icon to replace the emoji ⭐ used for favourites throughout the UI. (Owner: Kris)

## Dates on cards

Show start and end dates on banner cards.

## ✅ Grey-out inversion

~~Currently future items are dimmed; invert this — grey out **past** items instead. The planning-relevant content is ahead, not behind; dimming the future makes it read as unimportant.~~

Done: cards now dim only after their end date / closed banner state, so future and predicted planning targets stay visually active.

## Shield close affordance

Remove the × close button from shields — it's dated chrome. Where a shield naturally collapses back to a specific surface, replace the close with a directional flow arrow pointing toward that destination instead.

## Float the menubar and navbar

Both bars should float (fixed/overlay) so content scrolls beneath them rather than the bars occupying document flow.

## Editing controls consistency

Audit and unify all editing affordances. Pencil icons are doing the job but are visual noise — establish one consistent pattern and drop the icons where they're not carrying their weight.

## Rushed state signifier

Kale juice is the wrong icon for rushed. Replace with sprinting shoes (or similar speed/urgency metaphor). Add an orange flash tab on the card as a secondary signifier so rushed events are scannable at a glance.

## ✅ Commit trigger — remove dartboard

~~Remove the 🎯 commit button. Trigger the commit flow via a gesture directly on the banner card (double-click or long-press — decide at implementation time). Must be touch-friendly.~~

Done: removed the dartboard slug and made the persistent pity gutter the commit trigger, visible even at 0 pities. A whole-card double-click/long-press was trialled and dropped because it fought timeline panning.

## Income channel follow-ups

Done: League of Heroes, Strongest Team, and Masters Challenge are now wired as
graded event streams with naive play-style sliders. Defaults sit at midpoint
assumptions for now: League of Heroes Gold 4, Strongest Team B, Masters level 2.

Still to settle:

1. Tachyons (confirm name — you couldn't remember at capture time)
2. Revisit the naive slider labels/defaults once the analytical pass has signal

Follow-up: move shop ticket tier counts into baked config. The current frontend
stream hard-codes the naive monthly ticket counts by engagement tier; acceptable
for the passive/everyone-gets pass, but the tier values should live beside the
other income recipes rather than in TS.

## Menubar carats notifier

Fix the carats display in the menubar. Replace the text label with Tazuna's face as the icon/avatar.

Progress: carats display fixed — the balance button now shows carats only and is
single-height again (dropped the trainee/support ticket sub-line, which read a
confusing negative). Still TODO: the Tazuna-face avatar swap. Related: the
Resources surface now floors non-free-carat resources at 0, so a committed
shortfall stops reading as negative stock (free carats stay signed — the
overflow release valve).

## Remove Plan from menu

Drop the Plan entry from the navigation menu.

## ✅ Banner card icons

- ~~Dice rolls icon is a placeholder — find a proper replacement
- Presents — find an appropriate icon
- Explore showing available ticket count on the card

Total Pulls (Dice placeholder) | Free Carat Pulls | Paid Carat Pulls | Appropriate Ticket Pulls | Gift Pulls (present icon)~~

Done: banner cards now show a chin-style pull summary with total pulls plus gift/ticket/paid breakdown, backed by the same pull math as the commit shield. Final custom icon artwork is deferred for a later Aseprite pass.


## Pity shield — resource completeness + copy

- Audit what's shown: likely missing paid carat usage and possibly free carats — check carefully
- Add copy to explain the reserve-up-front / pay-at-end commitment model; it's not self-evident and users will misread the numbers without it

## Button design language

Audit and unify buttons across all surfaces — consistent shape, size, weight, and interaction states everywhere.

## Sliders + actual balance — rework
s
Both are a mess. Sliders need a clean-up pass (layout, labels, value display). The actual balance surface needs the same — review together since they're visually adjacent.

## LocalStorage key audit + versioning

- ✅ Inspect the live prototype site: old prototype keys are `ht_*`, while the current app owns `horsetrader.plan`, so there is no beta-blocking collision
- Optional post-beta: ship a one-time cleanup or migration that clears/remaps old `ht_*` prototype keys for existing testers
- Lock in a config schema version field; any field change requires a version bump so stale stored configs are invalidated cleanly rather than silently misread

## Actually play the game (the whole point)

- Finish the in-flight G1 missions (帝王賞 + ジャパンダートダービー)
- Smash Seek, Solve, Summer Walk! — get everything
- Prep sweep for Cancer Cup before it opens

## ETL — missing EN name warning

When an event has no English name (JP-only), emit a warning attributed to Eishin rather than silently baking JP text. Most of these can be machine-translated; the warning is the first step to surfacing the gap.

## ✅ Trainer card menu button

~~Show the trainer's name alongside the trainer card icon in the menu — makes the entry point obvious rather than relying on icon recognition alone.~~

Done: the identity button is now a pill — oshi portrait + trainer name + a dropdown chevron (the corner "sweep" moved to the right end). `menuIdentity` feeds the trainer name (was the oshi name); it truncates with ellipsis and collapses back to the bare avatar under 860px. Trainer-name entry is also now sanitised at the keystroke (letters/numbers/spaces/emoji, capped at 24 grapheme clusters).
