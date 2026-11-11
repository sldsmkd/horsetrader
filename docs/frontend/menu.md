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

In implementation terms every one of them is a `surface()` (glass plane), and
"surface" is both the product and the code noun — the old `overlay()` helper and
the "shield" type were collapsed into it (see [glass.md](glass.md) C-B3).

A third question — **what does this mean?** — is answered once, by Tazuna's
[first-run tour](#first-run-tazunas-tour), not by a permanent help button.

This doc is the menubar-specific design. Pair it with [ui.md](ui.md), which
captures the whole view layer, and [interaction.md](interaction.md), which
describes how these surfaces are mounted and wired.

## Layout

```text
[Home] [Date] [Oshi ▼]   [Search................]   [Plan] [🔨] [Balance ▼]
```

The left side carries stable identity, the centre carries discovery, and the
right side carries planning state.

- **Home** warps the timeline to today using the same smooth warp primitive as
  the film strip and search.
- **Date** reads the date at the view centre.
- **Oshi** (the player's avatar + trainer name) opens the **Trainer** page.
- **Search** finds entities and warps the timeline in place.
- **Plan** (tablet icon) opens the Desk. It only appears once a commitment exists.
- **🔨 Beta** opens the beta chamber; supporters only.
- **Balance** is a carat readout and opens Resources.

The timeline remains the application. Opening a menubar surface never changes
route, never replaces the canvas, and never captures timeline pan. On phones the
menubar presentation is chosen by `ui/caps/` (hidden in phone landscape), and
Trainer, Plan and Resources become full-viewport takeovers — see
[glass.md](glass.md).

## Menubar Shell

The shell is the menubar itself: the strip, layout, anchoring, and shared behavior
that every item depends on.

It is not an item. It owns:

- placement at the top of the timeline canvas;
- visual balance against the minimap at the bottom;
- the left-to-right item sequence and spacing;
- the shared anchoring behaviour for attached surfaces (the dropdown rail);
- the rule that the timeline stays live behind every open surface;
- the responsive collapse/degradation behavior when the strip runs out of room.

Implement the shell before the individual items. The items should mount into the
shell rather than each solving its own positioning, spacing, or layer.

## Trainer (Identity)

Identity is the former account concept narrowed to "who represents this stable?"
It is one native-scrolling **Trainer page** (`views/trainer/trainerPage.ts`):
identity at the top, Play Style beneath. It replaced the earlier two-window
Trainer Card + Play Style book.

Identity is not planner configuration, though some identity choices seed
configuration defaults. Its job is to make the planner feel like it belongs to a
stable before exposing spreadsheet-like controls.

### Trainer name and oshi

- **Trainer name** edits in place (hover-to-edit, no pencil). It is part of the
  synced plan (`config.identity.trainerName`) — see [persistence.md](persistence.md).
- **Oshi** — the horse who represents the stable, picked from the circular Uma
  icons. It supplies the menubar avatar, is the player's "this is me" signal, and
  has **no gameplay impact**. Close to the game's "Star Umamusume": not
  necessarily the strongest or favourite horse, though they may coincide.

### Club

Club belongs in Identity, not forecasting configuration. Players talk about clubs
as social affiliation; the rank is metadata on that affiliation. It can still
seed reward assumptions (club-rank income), but reads first as identity.

### Play Style

Play Style is the friendly front door to forecast assumptions — most players pick
how intensely they play instead of modelling every recurring reward stream:

```text
Sweetie · Casual · Focused · Dedicated · Unhinged · Custom
```

The selected preset seeds planner configuration; Custom exposes the same
controls as editable. The semantics of each preset are in
[identity-presets.md](identity-presets.md).

### Cloud save

The Trainer page also hosts **Cloud Save** (Unity): sign in with Google or Discord
to back up the plan and pick it up on any device, with a manual **Sync** button.
Use the same provider everywhere — there is no account linking. Disconnect deletes
the cloud save (after a confirm) and keeps the local copy. Optional; the planner is
fully usable signed-out. Semantics: [cloud-sync.md](cloud-sync.md).

> The old 12-digit **Trainer ID** was deleted; auth identity superseded it.

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

## First run: Tazuna's tour

There is no permanent help button. Tazuna — the game's secretary-guide, whom
players already associate with being shown the ropes — appears **once**, walks a
new visitor through the two inputs that make the forecast theirs, and is gone.
(Shipped as [Special Week](../projects/special-week.md).)

The tour (`ui/views/onboarding/onboarding.ts`):

1. **Welcome** — centred card: *"Horsetrader helps you plan future banners by
   projecting the resources you'll earn…"*, with a **Start setup** CTA.
2. **Trainer** — ring `.menubar__identity`: choose a play style; set name and oshi.
3. **Resources** — ring `.menubar__balance`: record what you have today.
4. **Outro** — *"You're ready — click any banner number to start planning."*

Trainer comes before Resources on purpose: picking your oshi is the "this is mine"
hook, and it sweeps left-to-right across the bar. Banner mechanics, card detail,
minimap and search are left to normal discovery.

**Presentation.** A fixed, centred Tazuna panel (portrait + one-line blurb) and a
green interactive-colour ring that glides to each target. No dim, not modal,
click-through: clicking the ringed button opens the real surface *and* advances
the tour. A missing target degrades to a centred card, never blocks boot.

**The `firstrun` watermark.** One synced integer, `remote.config.firstrun`
(absent ⇒ 0). On mount the app runs every stage whose index is `> firstrun`, in
order, persisting the mark per stage (a mid-tour reload resumes); Skip jumps it to
the last stage. It is a high-water mark, not a boolean, so:

- the stage registry is **append-only** — indices are the order; never insert;
- a stage added later reaches existing users once, without replaying the rest —
  the same mechanism can carry one-off announcements;
- it syncs, so a second device doesn't re-onboard (onboarding is about the person).

The write is silent (`coordinator.setFirstrun`, no notify/re-derive) — the mark is
economically inert. The beta chamber has a Replay / jump-to-stage knob for
iterating on the tour.

## Feedback fit

How this design answers the
[2026-06-04 first-run walkthrough](feedback/2026-06-04-first-run.md):

- **The site never says what it is** → the tour's welcome card.
- **Input fields read as calculated values** → Resources separates the dated
  snapshot the user enters from readouts sampled along the timeline.
- **Save gives no feedback** → Resources' **Record Balance** flow confirms visibly.
- **The balance/account screen exposed too much at once** → Trainer, Resources,
  Play Style and Advanced Configuration are progressively disclosed.

Not solved by the menu:

- **No path from a symbol to its explanation.** The decision to drop a persistent
  help home leaves glyph meanings to in-context copy and tooltips.
- **On-banner commit/remove affordances** live on the banner card and commit
  dossier ([ui-surfaces.md](ui-surfaces.md)).
- **False precision in projected pull values** is handled where those values
  render.

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
and Resources is what it can spend.
