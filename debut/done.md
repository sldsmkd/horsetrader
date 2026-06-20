# Debut - done

Completed items from the Debut readiness pass. This is the little receipt pile:
`polish.md` should stay focused on work that still wants attention.

## 2026-06-20

### Opt-in paid-carat spending (first live bug report — issue #65 hotfix)

First post-launch bug report: a player with a large paid-carat balance found the
planner treated those carats as unspendable (paid carats only ever left through the
daily-discount window, so most banked and read as broken). Real game lets paid carats
pay full price for any pull, so we were under-reporting capacity. Shipped a
per-commitment opt-in, off by default (keeps the frugal discount-only model):

- **Storage.** A commitment is now `number | { number, use_paid }` (`core/persistence/
  document.ts`, with `commitmentPity` / `commitmentUsePaid` accessors). The dict form
  persists only when the flag is on — a bare commitment stays a flat integer (sparse,
  like favourites/rushed). `validateCommitments` accepts both and drops malformed
  entries.
- **Spend waterfall (when on).** After the daily-discount window: burn free carats down
  to their `< 150` remainder, then spend owned paid carats at full price (150) toward the
  target, then surge any still-unmet need negative on free carats. Off = unchanged (paid
  banks, free absorbs the whole remainder negative). Lives in `spend()` in
  `core/projection/pulls.ts`; threaded through the projection debit (`reconcile`), the
  planner and card-gutter reads, and the commit-shield `reserve` forecast.
- **UI.** A "Spend paid carats at full price" checkbox in the commit shield (off by
  default, seeded from the stored flag so re-opening a paid plan stays ticked). Toggling
  re-renders the Resource Impact column live; `coord.commit(key, pity, usePaid)` persists.
- **Verification.** 243 tests green, typecheck clean; verified live against the reporting
  player's exact balance (free floors to the remainder, paid does the work, no over-surge).
- **Deferred (#65 read side).** The pre-commit card-face "pulls available" readout still
  ignores full-price paid, so it undercounts at a glance until you commit. Logged on #65
  for later.

## 2026-06-19

### Initial menubar and minimap float implemented

Converted the persistent top menu and bottom minimap/nav from edge-docked page bars
into floating glass-table chrome over the live timeline. The shared knobs live in
`css/base.css`: width, max-width, top offset, bottom offset, height, radius,
background, border, and shadow. Initial values are 80vw width, 5vh from the top
for the menu, and 5vh from the bottom for the minimap. This is not closed until
the layout blast damage is contained; the follow-up project is active in
polish.md.

### Menubar dropdowns re-anchored to the floating bar

Floating the bar had severed its dropdowns: the trainer book and resources card
were still pinned to the viewport corners, so on a wide screen the bar floated
inward while its menus stayed jammed against the edges. Added a `.chrome-dropdowns`
rail layer sized and centred with the same knobs as the bar, so its surfaces drop
in under the bar's own edges (left book off the left edge, right resources off the
right). Routing splits by the `overlay--center` marker — dropdowns hang on the
rail, viewport-centred shields stay in the overlay layer. Cards carry a
`--chrome-dropdown-scale` knob (0.8) and scale from the edge they're pinned to, so
they shrink inward instead of colliding. Bar width went to 85vw with the max-width
cap lifted to 160rem (ultrawide guard only). Known jank: `transform: scale` shrinks
the render but not the layout box, so card spacing reads slightly off — left in
polish.md for a later trim-vs-scale decision.

### Phone containment for Debut (contained, usable)

The phone portrait layout now fails in a contained way rather than stacking broken
chrome over the timeline. The menubar stacks cleanly (home + identity + carats,
search on its own row) and the bookmarks drawer is killed below 620px — which also
closes the can't-close trap, since the drawer's only opener (its chevron tab) lives
inside the container that gets `display: none`. Usable in portrait, which is the
Debut bar; coaxing the phone experience into real life is parked as a post-launch
project.

### Bookmarks drawer re-anchored to the floating bar

The favourites/plan drawer still used its pre-float geometry (`top: 4.5rem`, a
viewport-based max-height), so it sat level with the floating menubar — covering its
controls — and a long list could run past the bottom minimap. Dropped it onto the
same rail as the dropdowns (`top` = `chrome-top + chrome-height + gap`) so it floats
just under the bar, and capped its height with the shared `--chrome-dropdown-max-height`
(the room between the two floating bars) so the list scrolls inside instead of
overflowing. It now tracks the bar knobs automatically if they're retuned.

### Generic overlay close chrome retired

Removed the generic overlay title-bar close path entirely. Overlays still use
`title` as the dialog's accessible name, but surfaces and shields now own their
dismissal affordance in-body: Cancel buttons for write shields, collapse pills for
collapsible surfaces. Cloud Save and the inactive Beta chamber were brought into
that rule too, so no shield relies on a window `x`.

### Editing controls consistency accepted

Closed the editing controls consistency item. The Debut pattern is established:
trainer name uses hover-to-edit highlight and a focus ring rather than a loud
pencil control, and remaining edit affordances are acceptable for launch.

### Sliders cleanup accepted for Debut

Closed the sliders cleanup item. The Record Balance side is already converted
with title hero, explanatory copy, days-to-top-up input, and centred actions; the
play-style sliders/drawers are good enough for launch readiness and no longer
need to block Debut.

### Main surface/window chrome pass closed

Flagged the surfaces-and-shields once-over and generic window chrome retirement as
done for Debut's product surfaces. Main panels, oshi selector, club selector,
Record Balance, Commit, Cloud Save, and the inactive Beta chamber now avoid
generic window close chrome. The `confirmShield` reference is the small
shield-of-a-shield used for destructive cloud actions; it already relies on
explicit Cancel / confirm actions rather than a title-bar close.

### Commit shield reserve model copy added

Added concise Resource Impact copy to the commit shield explaining the planning
model: Horsetrader looks at what the player should have on the banner's last day,
then sets the selected pity aside from the first day so later banners cannot spend
the same resources twice. This closes the Debut copy gap around the
reserve-up-front / pay-at-end numbers.

### Expired favourites state declined

Decided not to add an explicit expired-favourite state. Silent culling is the
right behaviour: if a banner never reruns again, there is nothing useful to pull
on, so keeping a dead favourite around with a remove affordance would add noise
rather than trust.

### Rectangular below-card date badges added

Added live-window date ranges to below-lane rectangular banner cards:

- `BelowCard` now carries both `date` and `end`, keeping the visible event window
  separate from reward-posting semantics.
- Banner media renders a right-aligned dark date badge over the image, using the
  same micro typography scale as the above-line banner date.
- Champions Meetings replace the old large `CMn` overlay with `CMn · range`.
- Generic recurring mode banners get short community labels in the same badge:
  Tachyon, Kiseki, League, Legends, Masters, Skill Test, Strongest Team.
- Anniversaries, holidays, scenarios, and stories deliberately stay date-only
  because their banner art already carries specific information. Missions stay on
  the simpler non-banner treatment and do not need special copy.

Verification: `npm run check`, `npm run build`, and `npm test` passed from
`horsetrader.site/`.

### Oshi and club selectors converted

Brought the two identity pickers into the Debut shield language:

- Oshi selector and club selector overlays now use `overlay({ headerless: true })`,
  dropping the generic title bar / close button while keeping dialog labels.
- Each selector renders its own centred title hero.
- Actions now use `surfaceActions`, with explicit **Cancel** buttons replacing the
  removed header close affordance.
- The club picker keeps **Leave club** as the destructive action, but no longer
  pushes it to a corner.

Verification: `npm run check`, `npm run build`, and `npm test` passed from
`horsetrader.site/`.

### Cloud provider buttons branded

Replaced the Unity cloud provider picker placeholder glyphs with actual provider
marks and provider-coloured row accents:

- `CLOUD_PROVIDERS` now carries a `brand` key rather than `"G"` / `"D"` text.
- The cloud provider shield renders inline Google and Discord SVG marks.
- Hover and connected states tint from each provider brand while keeping the
  existing one-provider radio/toggle behaviour intact.

Verification: `npm run check` passed from `horsetrader.site/`.

### Identity surfaces design language established

The trainer card + play-style card now set Debut's glass-table surface language,
replacing the inherited Windows-app chrome. This pair is the reference the rest of
the shield once-over should follow.

What the language is:

- **No window title bar / `x`.** Surfaces hide the generic `overlay__header` and
  render their own identity instead. The play-style card promotes its preset
  icon+title mast; the trainer card promotes the editable **trainer name** as the
  card title.
- **Footer actions: centred, paired, bottom-anchored.** Not the corner-pinned
  Cancel-left / OK-right dialog split. (`justify-content: center` + `margin-top:
  auto`.)
- **Flow-marker chevrons.** Every chevron points where the content goes when you
  act on it. Trainer collapse pill → up (panel collapses up); play-style collapse
  pill → left (collapses into the trainer card); drawer marks → down when closed
  (expands down) / up when open (collapses up). Collapse pills are oriented to
  match (vertical pill for up, horizontal for left).
- **Hover-to-edit, no pencils.** The trainer name edits in place with a hover
  highlight + focus ring, matching the club row's affordance; the standalone
  pencil button is gone.
- **Identity over rows.** The oshi is the portrait, so her name is overlaid along
  the bottom of the portrait rather than sitting in a details row. Cloud Save
  moved into the right panel, filling the space the promoted name vacated.

Supporting fixes along the way:

- The play-style card body is a flex **column** and its grid template collapses to
  a single fill row when the header is hidden, so the surface fills the
  height-matched card and the footer actually sits at the bottom (the
  hidden-header-leaves-an-empty-`1fr`-row bug).
- Matikane stable names (Matikanetannhauser / Matikanefukukitaru) are split on the
  `Matikane` prefix so they wrap cleanly on the portrait; every other oshi name
  passes through untouched.

Verification: `npm run check` + `npm test` (238) green from `horsetrader.site/`.

### Glass-table language rolled across the rest of the main panels

Following the trainer + play-style reference pair, the remaining main panels were
brought into the language:

- **Resources surface.** Window header dropped; the carat headline is promoted to
  the hero spot at the top. Up-chevron collapse pill (collapses up toward the menu
  carats chip). The footer button reads **Record Balance** (was "Update Actual
  Balance"), centred, no pencil. The redundant **PREDICTED** label + its dead `ⓘ`
  tooltip were removed ("Projected on …" already says it).
- **Record Balance shield** (was "Edit Balance"). Window header dropped; "Record
  Balance" is a centred title hero with a one-line intro explaining it ("Copy your
  current totals straight from the game. The whole timeline projects forward from
  this snapshot, so re-record it whenever your real balance drifts."). Cancel is a
  real active button (handles dismissal now the `x` is gone); actions centred. The
  Daily Carat Pack field is now **days-to-top-up** ("Top up in `[N]` days",
  mirroring the game's "In 20d") instead of a date picker — it derives the stored
  cycle-boundary date as `today + N` (UTC) and round-trips back to days on load.
- **Commit shield.** Window header dropped; kind+run is a centred title hero
  ("Support Card Pickup" + date range subtitle). Cancel active; actions centred.
  Resource-impact display now floors **tickets and paid carats** at 0 like the
  resources surface (only free carats — the overflow release valve — read negative
  and redden). The pity stepper box reuses the **timeline badge's exact colour
  rule** (grey/green/purple/red), including the trainee-1 / support-3 thresholds.

### Shared surface components extracted

The repeated patterns were factored out so surfaces import rather than re-copy:

- **`collapsePill`** (`ui/views/collapsePill.ts` + css) — the flow-marker pill.
  `collapsePill({ direction: "up"|"left", float?, label, onClick })`. Used by
  trainer, play-style, resources.
- **`surfaceActions`** (`ui/views/surfaceActions.ts` + css) — the centred,
  bottom-anchored footer container. `surfaceActions(...buttons)`. Buttons keep
  their own look. Used by play-style, record-balance, commit.
- **`pityBand`** (`ui/widgets/pityBand.ts` + `pityBand.css`) — the shared pity
  colour rule (`empty|positive|waste|unfundable`, precedence unfundable→empty→
  waste→positive) + `.pity-band--*` fills. Used by the timeline commitment badge
  AND the commit shield, so they can't disagree.
- **`overlay({ headerless: true })`** — dropping the window title bar is now a
  first-class overlay option (skips the `<header>`/✕, keeps `aria-label` for the
  dialog name, collapses the grid in book/centre placements). Replaced five
  per-surface `.overlay--X .overlay__header { display:none }` CSS hides + dead
  close buttons. Overlays still using a header (selectors, confirm, cloud, beta)
  simply omit the flag — untouched.
- The Cloud / Sync buttons were centred (auto-width, not a full-width split bar)
  and a one-line explainer added under CLOUD SAVE ("Sign in to back up your plan
  and pick it up on any device.").

Also: the Debut metaphor in [debut.md](debut.md) was sharpened — the debut race is
already won; *Make Debut!* is the winners' **concert** song, so Debut is the
backstage moment before the concert (makeup, pinning the costume), ready to be seen.

Verification throughout: `npm run check` + `npm test` (238) green; UI eyeballed on
the live dev server.

### Debut frame captured

Created the Debut notes and board:

- [debut.md](debut.md) holds the backstage / readiness thesis.
- [polish.md](polish.md) holds the active loose-end board.

Debut is now framed as the moment before being seen: feature-complete after
Eclipse, with the timeline as the product and every surface as glass-table chrome
over it.

### Plan and Tazuna removed from the menu

Removed the dead top-level menu entries:

- Plan is still available as the second face of the Favourites drawer.
- Tazuna is no longer persistent chrome.
- The future Tazuna shape is parked as a first-run / announcement shield sequence
  in [polish.md](polish.md), not as a menu button.

Verification at the time: `npm run check` and `npm test` passed.

### Image payload audit completed

Audited the generated `static/` image payload with the launch question narrowed
to the timeline card path, not the total hosted archive.

Findings:

- Above-lane banner art is uniform `512x188`, small, and fine.
- Below mission badges are `256x128`, small, and fine.
- Below rectangular banners are the only heavier card-path family, but they are
  text-heavy `936x228` art and should stay crisp.
- No escaped oversized outlier was found on the timeline card path.

Decision: no resampling work for Debut. Keep large/detail art available for later
lightbox-style features; revisit only if a real first-paint network trace points
at a specific card-path problem.

Full notes: [image-audit.md](image-audit.md).

### Typography pass completed

Added a semantic type token layer beside the palette:

- `horsetrader.site/css/typography.css` now owns shared type roles for body copy,
  panel titles, surface titles, labels, captions, chips, controls, and numeric
  readouts.
- `main.ts` imports the typography layer between palette and base styles.
- High-traffic product surfaces now reference type roles rather than local
  `font-size` / `font-weight` guesses: timeline cards, atom chips, reward strips,
  menu chrome, Favourites/Plan rows, Identity, Resources, Commit shield, cloud
  shields, selectors, sliders, checkboxes, and play-style surfaces.
- Letter spacing on shared label roles is zeroed so compact uppercase labels stop
  inheriting the generic tracked-out admin-panel feel.

Intentionally left local: chart/debug HUD typography and a handful of glyph or
image-overlay line-heights where the metric belongs to the drawing, not to app
copy.

Verification: `npm run check`, `npm test`, and `npm run build` passed from
`horsetrader.site/`.

### Atom chip order polished

Moved the favourite star to the leading edge of banner atom chips and the support
attribute icon to the trailing edge.

Decision: favouriting is the action/intent, while the support icon is supporting
metadata. This also makes long names clip on the right instead of looking bitten
off at the left edge.

Verification: `npm run check` passed from `horsetrader.site/`.

### Button design language pass completed

Added a shared control token layer:

- `horsetrader.site/css/controls.css` now owns shared control radius, padding,
  neutral, hover, selected, primary, danger, commit-action, and disabled states.
- `main.ts` imports controls between typography and base styles.
- Menu buttons, Favourites/Plan tabs, cloud controls, cloud provider rows,
  oshi/club selectors, play-style presets/drawers/apply button, checkboxes,
  Resources edit, resource editor actions, Commit shield actions, confirm shield,
  and cloud conflict controls now reference the shared state language.

Semantic colour notes:

- Interactive green remains the app state for selected/active/editable/primary
  controls.
- Danger red is reserved for destructive or risky actions, now including confirm
  shield danger copy/buttons.
- Commit shield Save keeps the separate commitment-action purple because it is a
  planning transaction, not a generic OK/apply action.
- Cloud is the semantic exception: connection/sync/account state keeps its blue,
  but now through `--ht-colour-cloud` and cloud control tokens rather than
  hardcoded component blues.

Verification: `npm run check`, `npm run build`, and `npm test` passed from
`horsetrader.site/`; after the cloud-blue correction, `npm run check` passed
again.
