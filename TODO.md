

---

## Deferred / no action yet

<<<<<<< Updated upstream
- `rate_overrides` and `rushable` fields are in the schema but have no frontend
  consumer. Leave them alone until the gacha-rate surface is scoped.
- `strings.ts` `FALLBACK_STRINGS` duplicates `strings.json` — accepted trade-off
  for fetch-fail resilience; no action needed.
- `docs/ideas/menu.md` (513 lines) is exploration notes, not a spec. Review when
  the menubar epic (**#22**) surfaces that need to match it.
=======
- Show a counter: how many times the character still appears ahead in the timeline
- When count reaches zero: grey out the entry + show a remove (×) button
- Click jumps to the nearest upcoming occurrence ahead of the current timeline position
- If no occurrences remain ahead, wrap back to the first (earliest) one

## Bookmarks bar — planner flip

The bar has two faces (flip toggle, like a standing mirror reversed):

- **Bookmarks face** — starred characters (as above)
- **Planner face** — banners you've committed to, each showing the pity count on that commitment
- Flipping is a single UI toggle; both faces share the same bar slot/position in the layout

## Minimap bookmark/commit dots

Replace the current dot marks with two distinct glyphs keyed on the banner's state:

- **□ empty square** — banner contains a favourited character or card (bookmarked via content)
- **■ filled square** — banner has a commitment on it

Both can coexist if a committed banner also contains other favourites.

## Minimap above-the-line colour

- Blue only when the projection at that point is **positive** (above threshold)
- Explore a configurable threshold cutover: 0 pity, 1 pity, etc. — below threshold flips to red even if still above the lane
- Below-the-lane area is always red regardless

## Card styling — fixed width pass

Establish a consistent fixed width across all card types as the first styling pass. No card should be sized by its content.

## Card colour flashes

Restore the left-edge colour flashes that distinguish card types (supports vs trainees). These were present before and help at a glance without reading.

## Grouped banner layout — max 2 rows

When a concurrent group contains more than 2 banners, widen the group column into a grid rather than stacking deeper. Maximum depth is 2 rows; overflow goes into additional columns.

## Banner card — rate-up scroll area

When the rate-up character list overflows the card height, show a scroll area rather than clipping or expanding the card.

## Banner rate-up sort order

Sort rate-up characters consistently: crystal (high priority / featured) first, gold below, alpha-sorted within each tier group.

## Favourites icon — star fruit

Design and wire in a custom star fruit icon to replace the emoji ⭐ used for favourites throughout the UI. (Owner: Kris)

## Dates on cards

Show start and end dates on banner cards.

## Grey-out inversion

Currently future items are dimmed; invert this — grey out **past** items instead. The planning-relevant content is ahead, not behind; dimming the future makes it read as unimportant.

## Shield close affordance

Remove the × close button from shields — it's dated chrome. Where a shield naturally collapses back to a specific surface, replace the close with a directional flow arrow pointing toward that destination instead.

## Float the menubar and navbar

Both bars should float (fixed/overlay) so content scrolls beneath them rather than the bars occupying document flow.

## Editing controls consistency

Audit and unify all editing affordances. Pencil icons are doing the job but are visual noise — establish one consistent pattern and drop the icons where they're not carrying their weight.

## Rushed state signifier

Kale juice is the wrong icon for rushed. Replace with sprinting shoes (or similar speed/urgency metaphor). Add an orange flash tab on the card as a secondary signifier so rushed events are scannable at a glance.

## Commit trigger — remove dartboard

Remove the 🎯 commit button. Trigger the commit flow via a gesture directly on the banner card (double-click or long-press — decide at implementation time). Must be touch-friendly.

## Wire missing income channels

Four channels not yet wired:

1. League of Heroes (quarterly PvP)
2. Shop tickets
3. Strongest Team
4. Tachyons (confirm name — you couldn't remember at capture time)

## Menubar carats notifier

Fix the carats display in the menubar. Replace the text label with Tazuna's face as the icon/avatar.

## Remove Plan from menu

Drop the Plan entry from the navigation menu.

## Banner card icons

- Dice rolls icon is a placeholder — find a proper replacement
- Presents — find an appropriate icon
- Explore showing available ticket count on the card

## Pity shield — resource completeness + copy

- Audit what's shown: likely missing paid carat usage and possibly free carats — check carefully
- Add copy to explain the reserve-up-front / pay-at-end commitment model; it's not self-evident and users will misread the numbers without it

## Button design language

Audit and unify buttons across all surfaces — consistent shape, size, weight, and interaction states everywhere.

## Sliders + actual balance — rework

Both are a mess. Sliders need a clean-up pass (layout, labels, value display). The actual balance surface needs the same — review together since they're visually adjacent.

## LocalStorage key audit + versioning

- Inspect the live prototype site: enumerate what keys are actually stored, identify any stale/random ones from early development
- Ship a one-time cleanup that clears unknown keys for existing users
- Lock in a config schema version field; any field change requires a version bump so stale stored configs are invalidated cleanly rather than silently misread

## Actually play the game (the whole point)

- Finish the in-flight G1 missions (帝王賞 + ジャパンダートダービー)
- Smash Seek, Solve, Summer Walk! — get everything
- Prep sweep for Cancer Cup before it opens

## ETL — missing EN name warning

When an event has no English name (JP-only), emit a warning attributed to Eishin rather than silently baking JP text. Most of these can be machine-translated; the warning is the first step to surfacing the gap.

## Trainer card menu button

Show the trainer's name alongside the trainer card icon in the menu — makes the entry point obvious rather than relying on icon recognition alone.
>>>>>>> Stashed changes
