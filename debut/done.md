# Debut - done

Completed items from the Debut readiness pass. This is the little receipt pile:
`polish.md` should stay focused on work that still wants attention.

## 2026-06-19

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
