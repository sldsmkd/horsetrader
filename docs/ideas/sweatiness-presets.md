# Idea: Sweatiness presets for PvP capability

Status: **exploration** — not committed, no code. Frontend (account config) concern.

## Problem

Henry Handsome makes the player self-locate on ~five independent PvP capability
sliders, each in its own grading vocabulary:

- Team Trials (Class 1–6)
- Club Rank (D+ … SS)
- Champion's Meeting (Open League / Group B / placement)
- League of Heroes (Silver … Platinum tier)
- (and more — coverage is incomplete)

See [sweatiness1.png](sweatiness1.png) (the input panel) and
[sweatiness2.png](sweatiness2.png) (the underlying reward tables).

This is awkward: the player knows "I finish mid-pack" but must translate that into
a class **and** a rank **and** a group **and** a tier, per event type. The scales
also drift as the game rebalances, so a static spreadsheet rots.

## Idea

Borrow the **PC graphics-settings idiom** (Low/Med/High/Ultra + Custom):

- A single curated **sweatiness** preset selector. One ordinal self-assessment —
  "how sweaty am I" — fans out into a coherent tuple across all the scales.
- An **Advanced mode** checkbox that reveals the raw per-scale sliders.
- Tuning any slider drops the player onto **Custom**; presets stay selectable to
  snap back.

One choice replaces five; the raw sliders are still there for anyone who wants them.

## Design notes / open questions

1. **Is sweatiness one-dimensional?** Probably not perfectly. Team Trials class is
   mostly grind/time (a chill daily player hits Class 6); CM and League of Heroes are
   roster-strength head-to-head. So real players go off-diagonal (Class 6 but Open
   League). This is the *justification* for the dual mode: presets nail the correlated
   common archetypes (~80%); Custom exists for the off-diagonal player. Tune presets to
   **real archetypes**, not a naive monotonic ramp.

2. **Where does the preset→tuple mapping live?** It's curated knowledge about *player
   behaviour archetypes*, not about the game's events. Lean **frontend-side curation**,
   not the bake. ETL still owns "Group B 1st = 1800 carats + 6 tickets"; the frontend
   owns "a Preset-3 player typically lands Group B 1st." Don't reflexively push it into
   the bundle.

3. **What persists, and as what?** The *resolved* per-scale values are account facts —
   they drive income → projection. The preset-vs-Custom selection is the input
   mechanism. Persist both as **account config** (which preset + any custom overrides),
   same class as Henry Handsome's slider state — not a view pref.

## Why it fits horsetrader

- Purely additive: a lens over the existing five scales. No change to the reward model
  or the bake.
- Reinforces the "edge over a spreadsheet" thesis — the prior art (Henry Handsome)
  exposes raw sliders; the edge is a friendlier front door that still drops to the
  spreadsheet on demand.

## TODO if pursued

- Define the real archetype set (what N player profiles the presets encode).
- Decide preset count + naming (community vernacular — "sweatiness" already pre-taught).
- Confirm coverage: which scales are in scope (the calculator misses some).
