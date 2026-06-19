# Debut — polish board

Loose ends that fit Debut's backstage-readiness pass. This is a working board, not
a replacement for the original notes; source links point back to where the item
was first captured. Completed items move to [done.md](done.md).

Debut-shaped means: visible polish, first-contact confidence, copy, delivery,
public-facing hygiene, and small interaction seams. Bigger product directions or
new subsystem work should graduate out of this file.

## Highest-signal pass

> **Surface design-language conversion status (2026-06-19).** The glass-table
> language is established and rolled across all the *main* panels: trainer card,
> play-style card, resources surface, Record Balance shield, commit shield. Shared
> tools to reuse when converting the rest: `overlay({ headerless: true })` (drops
> the title bar / ✕, keeps `aria-label`), `collapsePill`, `surfaceActions`,
> `pityBand`. **Still on the old window chrome (not yet converted):** oshi selector,
> club selector, confirm shield, and the cloud shields (cloud is a *deliberate*
> hold — leave as-is unless asked). See done.md for the full receipt + the rules.

- **Pity shield copy and completeness.** Representation DONE: tickets/paid carats
  floor at 0, free carats read negative (release valve) and redden, and the pity
  box reuses the timeline colour bands. REMAINING: concise copy for the
  reserve-up-front / pay-at-end model so the numbers do not read like magic.
  Source: [TODO.md](../TODO.md).
- **Surfaces and shields once-over.** All main panels are converted (see the status
  note above + done.md). REMAINING for a full once-over: bring the **oshi selector,
  club selector, and confirm shield** into the language (use `overlay({ headerless })`
  + `surfaceActions`; title hero; centred actions). Cloud shields deliberately left.
  Source: user note.
- **Retire generic window chrome.** DONE for all main panels via the
  `overlay({ headerless })` option. REMAINING: the selectors + confirm shield still
  carry the window title bar / `x`. Source: user screenshot/note.
- **Tazuna first-run / announcement flow.** Tazuna can return as a one-shot shield
  sequence, not as persistent menu chrome. Store a `firstrun` counter/version; on
  app load, if the saved counter is behind, set/display `firstrun 1` (or the next
  unseen step). Each shield has **OK** when no next step exists, otherwise **Next**;
  acknowledged steps vanish forever. Later one-off announcements can ship at a
  higher counter level so every existing player sees them once. Source: user note.
- **Sliders cleanup.** (Actual-balance side DONE — the Record Balance shield is
  converted: title hero, intro copy, days-to-top-up input, centred actions.)
  REMAINING: the play-style sliders/drawers — layout, labels, value display, and
  making input-vs-derived state legible. Source: [TODO.md](../TODO.md).

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
- **Shield close affordance.** Pattern established: flow-marker chevron pills that
  point in the dismiss direction (up = collapses up, left = collapses into the
  owning surface). REMAINING: roll this onto the shields still carrying dated `x`
  close chrome. Source: [TODO.md](../TODO.md).
- **Editing controls consistency.** Pattern established on the trainer name:
  hover-to-edit highlight + focus ring, no pencil. REMAINING: drop the remaining
  pencil icons (e.g. the portrait edit glyph) and any other shouting edit chrome
  where hover/contextual affordance carries it. Source: [TODO.md](../TODO.md).
- **Favourites / Plan surface identity.** Revisit drawer colour/contrast in a real
  planning session; decide whether the expanded surface needs a stronger identity.
  Source: [TODO.md](../TODO.md).
- **Plan share shield / report view.** Keep the drawer Plan face as functional
  navigation mirroring Favourites, but add a separate pop-out shield for a
  screen-grabbable plan report. It should read like a clean route card players can
  screenshot and paste into Discord for feedback: oshi icon/name, trainer and club
  context, clear banner art, dates, pity counts, and a small callback/attribution to
  `horsetrader.site` so the image can travel outside the app and still point home.
  Source: user note.
- **Favourites / Plan / Identity layering.** Re-think how the Favourites/Plan drawer
  and Identity surface coexist: clipping, overlap, z-order, shadows, and whether
  an opened identity card should partially cover, push, dim, or otherwise negotiate
  with the drawer beneath it. The current overlap reads awkward rather than
  intentionally glass-layered. Source: user screenshot.
- **Expired favourites state.** Silent culling may be fine, but if it feels hidden,
  add an explicit expired-favourite state with remove control. Source:
  [TODO.md](../TODO.md).

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

- **Below-the-line date ranges.** Above-line banners now show compact ranges. Thread
  `end` through below-lane cards and display live windows for scenarios, stories,
  missions, holidays, legend races, and CMs without confusing reward post date
  with event window. Source: [TODO.md](../TODO.md).
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
