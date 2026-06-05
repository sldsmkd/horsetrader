# Menubar

The menubar is the top strip floating over the timeline canvas. It is the visual
counterpoint to the minimap: the menubar samples and controls the view at the top
of the canvas, while the minimap summarises and navigates the whole axis at the
bottom.

The menubar contains a left-to-right sequence of **items**. Use "item" as the
umbrella term: an item may be a control, chip, readout, toggle, field, or avatar
depending on its shape. Avoid "widget" as canonical terminology; the existing
docs use it only casually. House language is "surface" for substantial UI areas
and "control" / "readout" / "toggle" for specific affordances.

Several menubar items open small attached surfaces. Those surfaces are not
destinations and do not replace the timeline. The old "Account" surface is split
into the two questions players actually ask while planning:

- **Identity** — who is looking at this timeline?
- **Resources** — what can they spend?

In implementation terms, these attached UI surfaces mount through the overlay
machinery. **Surface** is the product/design noun; **overlay** is the code and
layering noun.

Tazuna stays separate from both. She answers a third question: **what does this
mean?**

This doc is the menubar-specific design. Pair it with [ui.md](ui.md), which
captures the whole view layer, and [interaction.md](interaction.md), which
describes how these surfaces are mounted and wired.

## Layout

```text
[Home] [Date] [Representative Uma ▼] [Search................] [Plan] [Balance ▼] [Tazuna]
```

The left side carries stable identity, the center carries discovery, and the
right side carries planning state and help.

- **Home** warps the timeline to today using the same smooth warp primitive as
  bookmarks and search.
- **Date** reads the date at the view center.
- **Representative Uma** opens Identity.
- **Search** finds entities and warps the timeline in place.
- **Plan** opens the plan surface. Its exact UX and icon are pending.
- **Balance** is a carat readout and opens Resources.
- **Tazuna** opens help, onboarding, and explanations.

The timeline remains the application. Opening a menubar surface never changes
route, never replaces the canvas, and never captures timeline pan.

## Menubar Shell

The shell is the menubar itself: the strip, layout, anchoring, and shared behavior
that every item depends on.

It is not an item. It owns:

- placement at the top of the timeline canvas;
- visual balance against the minimap at the bottom;
- the left-to-right item sequence and spacing;
- the shared overlay anchoring behavior for attached surfaces;
- the rule that the timeline stays live behind every open surface;
- the responsive collapse/degradation behavior when the strip runs out of room.

Implement the shell before the individual items. The items should mount into the
shell rather than each solving its own positioning, spacing, or overlay layer.

## Identity

Identity is the former account concept narrowed to "who represents this stable?"
It is closer to a Trainer Card or Stable Card than a settings page.

```text
Sweep Tosho

Representative Uma
Sweep Tosho

Club
UmaDen (B+)

Play Style
Competitive

Trainer ID
765•••••••••
```

Identity is not planner configuration, though some identity choices seed
configuration defaults. Its job is to make the planner feel like it belongs to a
stable before exposing spreadsheet-like controls.

### Representative Uma

The representative Uma is the stable's primary identity.

- It supplies the menu avatar.
- It anchors first-run onboarding.
- It can later support sharing, export, and social features.
- It has **no gameplay impact**.

The model is intentionally close to the game's "Star Umamusume" concept: the
horse who represents the stable. It is not necessarily the player's strongest
horse or favourite horse, although those may coincide.

Use the existing circular Uma icons. The selected character is the player's
"this is me" signal in the planner.

### Club

Club belongs in Identity, not forecasting configuration. Players naturally talk
about clubs as social affiliation; the rank is metadata attached to that
affiliation, not a player-power headline.

The club rank can still seed reward assumptions where needed, but the surface
should read first as identity:

```text
UmaDen
B+
```

### Play Style

Play Style is the friendly front door to forecast assumptions. It replaces
exposing a pile of rank pickers and reward parameters during onboarding.

Initial options:

```text
Very Chill
Casual
Competitive
Degenerate
Custom
```

The selected archetype seeds planner assumptions. Advanced users can override
the generated configuration later.

This is the same direction as the sweatiness preset work: most players should
pick how intensely they play, not manually model every recurring reward stream
before they understand the app.

### Trainer ID

Trainer ID is optional.

It can support stable hash generation, poll deduplication, future social
features, or share-link niceties. It is **not authentication**, not security
critical, and not required for the planner to work.

## Resources

Resources is the former balance/account modal narrowed to "what can I spend?"
It owns the dated resource snapshot and the player-controlled inputs that affect
affordability.

```text
Pull Economy

Carats              39,528
Trainee Tickets          42
Support Tickets          11

Recovery Assets ▼

Balance on May 28, 2026
```

### Pull Economy

Pull Economy contains the primary planning currencies: carats and scout tickets.

Players think in combined savings:

```text
34k carats + 42 tickets
```

So tickets belong beside carats, not buried in miscellaneous inventory. Trainee
and support tickets remain separate pools because they resolve against different
banner kinds.

Carats stay the most important resource and are always visible. Free vs paid is
an implementation/config distinction; the top-level Resources read should avoid
making a new player solve that distinction before the planner is useful.

### Recovery Assets

Recovery Assets are secondary planning resources and are collapsed by default.

```text
Rainbow Crystal
Gold Crystal

Rainbow Shards
Gold Shards
```

They answer "what happens if this banner goes badly?", not "can I pull?" They
matter for recovery and limit-break planning, but they should not compete with
carats and tickets as the main savings read.

### Snapshot Date

Resources remains tied to a dated snapshot:

```text
Balance on May 28, 2026
```

The date belongs inside Resources rather than occupying primary menu space. It
is the anchor the projection runs forward from; the menu balance is a readout
sampled from that projection.

### Advanced Configuration

Most users should not see weekly login state, daily-pack days remaining, monthly
ticket assumptions, Champion's Meeting forecast parameters, or participation
scales during first run.

Those controls still need a home, but behind an **Advanced Configuration**
affordance from Resources or Play Style. They are configuration overrides, not primary
identity or resource state.

Configuration and Settings are different buckets:

- **Configuration** is the user's account/forecast model. It feeds projection and
  includes ranks, cadences, monthly assumptions, paid-currency inclusion, and
  participation scales such as "do not participate" through "sweaty".
- **Settings** are presentation or behavior preferences, such as theme or
  animation. They do not describe the stable and do not feed projection.

## Tazuna

Tazuna is not the representative Uma and not account state.

```text
Representative Uma: this is me.
Tazuna: what does this mean?
```

She remains the dedicated help and onboarding affordance. This gives the repeated
"info circle" ask from first-run testing a single home without scattering a help
icon onto every field.

Tazuna covers:

- the first-run welcome and "what is this planner?" explanation;
- symbol explanations, including pull/readout glyphs;
- first-save feedback and "snapshot vs projection" explanation;
- field-level meanings for domain-heavy controls;
- later documentation or guided help.

The feedback principle is important: the user should have a visible place to ask
for meaning before they are stranded by an unfamiliar glyph or control.

## First Run

First run collects only enough information to make the planner useful:

1. Choose a representative Uma.
2. Enter current carats.
3. Choose Play Style.

Club and Trainer ID are optional. Tickets and recovery assets can be added from
Resources after the planner is alive.

Avoid spreadsheet-style onboarding. The site should become useful first, then
let advanced users refine assumptions.

## Feedback Fit

This design directly answers several findings from the
[2026-06-04 first-run walkthrough](feedback/2026-06-04-first-run.md):

- **The site never says what it is.** Tazuna now has an explicit onboarding role,
  and first run starts from "who represents your stable?" rather than a cold
  spreadsheet configuration surface.
- **No path from a symbol to its explanation.** Tazuna is the persistent home for
  meanings, including menu symbols and banner pull/readout glyphs.
- **Input fields read as calculated values.** Resources should visually separate
  the dated snapshot the user enters from projected readouts sampled along the
  timeline.
- **Save gives no feedback.** The Resources save action should visibly confirm
  success, and Tazuna should explain the first successful save.
- **The balance/account screen exposed too much at once.** Identity, Resources,
  Play Style, and Advanced Configuration split the old surface into progressively
  disclosed concerns.

Two feedback items are not solved by the menu alone:

- **On-banner commit/remove affordances** remain part of the banner and plan
  redesign in [ui.md](ui.md), not the menu.
- **False precision in projected pull values** should be handled wherever those
  values render, especially banners and the plan.

## Future Growth

Identity can later grow into owned/stable concepts:

- roster;
- supports;
- collection progress.

Resources can later grow into planning/resource concepts:

- pull history;
- forecast deltas;
- banner affordability summaries;
- recovery planning.

These additions should preserve the same split: Identity is who the stable is,
Resources is what it can spend, and Tazuna is how the player asks for meaning.
