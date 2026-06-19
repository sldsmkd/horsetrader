# Debut — polish board

Loose ends that fit Debut's backstage-readiness pass. This is a working board, not
a replacement for the original notes; source links point back to where the item
was first captured. Completed items move to [done.md](done.md).

Debut-shaped means: visible polish, first-contact confidence, copy, delivery,
public-facing hygiene, and small interaction seams. Bigger product directions or
new subsystem work should graduate out of this file.

## Highest-signal pass

> **Surface design-language pass is done for Debut (2026-06-19).** The glass-table
> language is established across the main panels and launch-critical shields:
> trainer card, play-style card, resources surface, Record Balance shield, commit
> shield, oshi selector, and club selector. Cloud modals are a deliberate hold —
> leave as-is unless asked. See done.md for the receipt and reusable surface tools.

## Timeline and glass-table chrome

- **Float the menubar and minimap.** These are core visual-identity instruments,
  not page bars. They should read as glass-table chrome floating over the live
  timeline rather than occupying document flow. Confirm the current layout before
  changing code. Source: [TODO.md](../TODO.md), user note.
- **Responsive zoom limits.** Re-check timeline zoom bounds on devices below a
  1440p-style viewport, especially phones. The current limits can get silly on
  narrow screens; tune or make them viewport-sensitive so zoom remains useful
  without losing the scene. Source: user note.
- **Phone containment media queries.** Add only the media-query fallbacks needed
  for phone layout to fail in a contained way: hide, collapse, or simplify
  nonessential chrome instead of stacking broken extra content over the timeline.
  Coaxing the phone experience into real life is a later project, not Debut.
  Source: user note.
## Icons and visual signifiers

- **Favourites star fruit.** Replace the emoji favourite marker with custom star
  fruit artwork. Source: [TODO.md](../TODO.md).
- **Banner pull icons final art.** The pull summary is functional; final custom
  icon art is deferred to an Aseprite pass. Source: [TODO.md](../TODO.md).
- **Aseprite placeholder icons.** Clean up ripped in-game placeholder assets into
  proper transparent item icons: resize to the intended UI scale, remove the
  button-like background/frame, and keep only the item/readable symbol itself.
  Source: user note.

## Date and copy details

- **Grouped banner mixed-end copy.** Groups are keyed on shared start, but rare
  groups have mixed end dates. Decide whether to keep max-end span, show a range
  only when all ends agree, or render per-banner ends. Source: [TODO.md](../TODO.md).

## Public-facing hygiene

- **Pre-hydration / first paint.** The app already has a pre-hydration loading
  surface. Debut should make it feel intentional and fast without turning it into
  a separate homepage. Sources: [base.css](../horsetrader.site/css/base.css),
  [debut.md](debut.md).
- **Share-ready surfaces.** Check README pointers, public repo surfaces, screenshots
  or short clips, credits/disclaimers, and the community-language announcement text.
  This is "fan-built site readiness", not commercial go-to-market.

## Human backstage

- **Play the damn game.** Schedule enough real human time to close out the current
  story before it disappears. Debut polish should not consume the game window the
  planner exists to help with. Source: user note.
