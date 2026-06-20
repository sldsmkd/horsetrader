# Debut - parked

Ideas captured during Debut that are not on the launch-critical path. These are
new functionality or later product directions, not readiness polish.

## Future flows

- **Tazuna first-run / announcement flow.** Tazuna can return as a one-shot shield
  sequence, not as persistent menu chrome. Store a `firstrun` counter/version; on
  app load, if the saved counter is behind, set/display `firstrun 1` (or the next
  unseen step). Each shield has **OK** when no next step exists, otherwise **Next**;
  acknowledged steps vanish forever. Later one-off announcements can ship at a
  higher counter level so every existing player sees them once. Source: user note.

## Later projects

- **Favourites / Plan surface identity.** Revisit drawer colour/contrast in a real
  planning session; decide whether the expanded surface needs a stronger identity.
  This is a product/design project, not launch polish. Source: [TODO.md](../TODO.md),
  user note.
- **Plan share shield / report view.** Keep the drawer Plan face as functional
  navigation mirroring Favourites, but add a separate pop-out shield for a
  screen-grabbable plan report. It should read like a clean route card players can
  screenshot and paste into Discord for feedback: oshi icon/name, trainer and club
  context, clear banner art, dates, pity counts, and a small callback/attribution to
  `horsetrader.site` so the image can travel outside the app and still point home.
  This is a project, not Debut polish. Source: user note.
- **Floating timeline chrome + mobile (project in its own right).** *Graduated
  2026-06-20 → [Grand Masters](../grand-masters/grand-masters.md); Part 1 (order &
  discipline) is [Byerley Turk](../grand-masters/byerley-turk.md).* The glass-table
  chrome is good enough for launch: the menubar/minimap float over the timeline, the
  dropdown rail re-anchors to the bar's edges with a `--chrome-dropdown-scale` knob,
  and the phone layout is contained (stacked bar, drawer killed, usable in portrait —
  see done.md). Picking it up properly post-launch is one project covering: the scale
  jank (transform shrinks render not layout box — trim-vs-scale decision), the rest of
  the blast-damage containment (overlap with timeline cards, scenario art, the bottom
  minimap), responsive zoom limits on sub-1440p/narrow viewports, and the real mobile
  experience (touch ergonomics, deliberate layouts rather than collapsed desktop
  chrome). Source: [TODO.md](../TODO.md), user note.
- **Grouped banner mixed-end copy.** Groups are keyed on shared start, but rare
  groups have mixed end dates. Decide whether to keep max-end span, show a range
  only when all ends agree, or render per-banner ends. Not launch-critical. Source:
  [TODO.md](../TODO.md).
- **Favourites / Plan / Identity layering.** Re-think how the Favourites/Plan drawer
  and Identity surface coexist: clipping, overlap, z-order, shadows, and whether
  an opened identity card should partially cover, push, dim, or otherwise negotiate
  with the drawer beneath it. This belongs with the broader Favourites/Plan project,
  not Debut polish. Source: user screenshot, user note.
