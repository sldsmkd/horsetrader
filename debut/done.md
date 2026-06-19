# Debut - done

Completed items from the Debut readiness pass. This is the little receipt pile:
`polish.md` should stay focused on work that still wants attention.

## 2026-06-19

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
