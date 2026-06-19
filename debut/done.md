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
