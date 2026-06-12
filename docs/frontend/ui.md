# UI (the view layer)

How the site *presents itself*: the principles that keep the view layer honest,
and the surfaces that follow from them. This doc is the **spine** — the ten
founding principles in dependency order. The per-surface detail lives next door:

- [ui-timeline.md](ui-timeline.md) — the timeline substrate, the two lanes,
  transaction timing, rushable events, the minimap
- [ui-surfaces.md](ui-surfaces.md) — banner card, bookmarks, menubar, search,
  the menu surfaces, the dev panel, the plan, layout edge cases

Pair with [conventions.md](conventions.md) (language, layering, DOM patterns),
[architecture.md](architecture.md) (the no-server driver and the layering rule),
and [engine.md](engine.md) (the coordinator API: `settledEvents`,
`projection`, `balanceAt`, `availableFor`, typed mutators, `subscribe`).

---

## The spine

Ten principles, in dependency order. Everything else hangs off these.

### 1. The timeline is the persistent substrate, not a "screen"

There is **one canvas, always mounted, always interactive** — a horizontal,
grabbable, inertial time-as-x world. It is the core representation *and* the
primary navigation of the whole site. Everything else (search, menu surfaces, the
plan, a card lightbox) is a **non-blocking overlay floating over a still-live canvas**:
overlays are fixed-position siblings, mounted/unmounted independently; they never
replace, pause, or tear down the timeline. The user can always grab the world and
move it.

- **No router / screen-swap model.** One canvas, always present. Overlays don't
  own or block it.
- **"Focus" elsewhere is signified softly** (a dim/blur of the canvas is the
  candidate), never a modal lock that captures input. The blur is a *derived
  view of one UI-state flag* (`overlayOpen → canvas dimmed`), flowing one way —
  not something each overlay imperatively imposes.
- **The invariant is absolute: nothing ever captures the timeline's scroll.** No
  overlay — not even the most deliberate announcement — takes over the user's
  ability to grab and move the world; overlays **float in front until dismissed**,
  full stop. The most assertive thing we allow is the **version / "what's new"
  announcement** (front-and-centre, once per app version — a stored "last seen
  version" vs current, reusing the persistence machinery), and **even it does not
  lock scrolling**: you can grab the world behind it. There is **no** focus-taking
  exception — the earlier "may take focus with a backdrop" framing was wrong (see
  [ui-surfaces.md](ui-surfaces.md#the-whats-new--changelog-overlay)). The single
  tolerated breach anywhere is the dev panel's native `alert()` — an **intentional,
  dev-only** break of this contract, never on a product surface.
  - *Where this came from:* the old **plan screen** sat front-and-centre, yet the
    player would still want to **jink the timeline** — nudge it to peek at something
    behind the plan without dismissing it. If even the most front-and-centre overlay
    must keep the world live-scrollable behind it, **every** overlay must. The
    invariant is the generalisation of that one concrete need.

> Cost to decide with a measurement, not up front: blurring a large scrollable
> canvas can be a real per-frame GPU cost on the user's device. Parked.

### 2. The axis is true-to-date — spacing is information

x maps to the **actual date** (`xForDate`), never to "next event" adjacency. A
gap is a real gap; a cluster is a real cluster. The empty stretches and the dense
knots **are the output** — the "density of interest / pressure points readable at
a glance" that is the planner's whole edge over a spreadsheet (see
[architecture.md](architecture.md)).

This is what separates a **planner** from a **browser**. A reference site that
packs uniform cards in event-order optimises *density* (it's a browser); we
optimise *legibility of timing and kind* (we're a planner) and therefore accept
the cost — lots of empty canvas, more panning — because compressing the axis
throws away the very signal that distinguishes us.

> Parked affordance: long empty runs mean a lot of panning. The fix is
> navigation ("jump to next cluster", the minimap doing the heavy lifting), never
> compressing the axis.

### 3. Above / below the line is a P&L axis

The line is a **profit-and-loss statement on a time axis**, not "banners vs other
stuff":

- **Above — heroes / what I'm planning *FOR*.** Banners. The **sinks**. Naturally
  information-rich (featured trainees/supports, costs, pity), because the spend
  decision lives here.
- **Below — what I'm *DOING* / what generates income.** CMs, missions, stories,
  legend races, logins. The **sources**.

The unification: **the spatial split is the visual expression of the ledger's
sign.** Negative deltas (spend) are committed above; positive deltas (income)
land below; the running balance threading through (minimap line, cursor balance)
is literally **the bottom line**. Above / below / balance *is* the signed
[ledger](projection.md) given a vertical axis.

Banners **group by "marketing beat"**: concurrent banners (shared start) render in
one outer container with the **date on the container**, not per-card. This mirrors
the upstream truth — in-game, Cygames presents simultaneous scouts as one carousel
with a shared end time, and caps concurrent banners so the marketing beat stays
surfaceable. So "banners starting on date X" is a *naturally bounded, meaningful
unit*, not an arbitrary collision bucket.

> Resolved (lean): the [menu](menu.md) settles this — player-facing setup is split
> between Identity, Resources, and advanced configuration. Income is configured
> **parametrically and globally** (ranks/presets, a login cadence), *not* via
> per-event below-lane toggles. The below lane stays **passive sources**;
> per-instance reconciliation rides the
> [rushable toggle](ui-timeline.md#rushable-events-the-opt-in-inversion) instead.
> The P&L frame was the right way to reason about it; the answer is "no new
> below-lane input."

### 4. The anchor is sacred; the body is negotiable

Every card has **one truth-bearing element pinned to its real date**; everything
else may deform to stay readable. **The UI deforms before it lies about *when*.**

- **Below lane:** the stem/x is the true date (sacred); the **y-offset** deforms
  to avoid overlap (vertical collision-stacking).
- **Above lane:** the stem is the true date (sacred); the **card body's x** nudges
  to fit when rich containers crowd.

Two rules fall out, both load-bearing:

- **Never corrupt a semantic to win a layout fight.** When two banners launched a
  day apart can't both sit on their true x, you nudge the *bodies* and keep the
  *stems* exact — you do **not** merge them into a group, because grouping *means*
  "same marketing beat / shared date." Grouping is a semantic contract, not a
  layout tool.
- **If you can't make it work, don't force it.** True pathological edges (the
  day-apart-banner crowding has happened ~once in five years) get a cheap hack
  that preserves the invariant (stems exact, bodies best-effort, approximation
  accepted at the limit), not elaborate machinery. Over-engineering judgment,
  applied honestly.

> Hard output requirement for the above-lane packer: when a body is nudged off its
> stem, the stem must still **visibly connect body → true tick** (an elbowed/
> leaning stem), so the honesty stays *legible*, not merely technically-correct.

### 5. Colour and desaturation are languages, not decoration

- **Grey = "trust this less."** One consistent grammar across two independent
  sources of uncertainty: **predicted** event dates (Fuku-chan's Global
  predictions) *and* **snapshot staleness** (the today-dot and carats total trend
  white→grey over a fresh→≥7-days range). The mechanism is deliberately simple (a
  linear range, not clever) and that's correct.
- **Per-type accent = kind.** Below-lane cards carry a left-border colour per type
  (CM / mission / legend race / special / story) so you read *what kind* before
  you read a word.
- **Borrowed grammar = rarity / attribute.** Above-lane banner-content pills carry
  the *game's own* rarity and attribute colours (see
  [ui-surfaces.md](ui-surfaces.md#the-banner-card-above-lane-contents)). This is
  a stronger rule than "colour carries meaning": **mirror the upstream grammar so
  no legend is needed** — a returning player decodes gem/gold rarity pre-verbally
  because it's the same language they already read in-game.

The *palette itself* is appearance and is **not** pinned here; the rule —
colour carries meaning, and where the game already speaks a colour we speak it
back — is.

This **generalises past colour to *symbols***. Control icons are sourced from the
game's own in-game **touch buttons** (Cygames ships them with the client), then
cleaned in **Aseprite** — rescaled, touch-affordances stripped — so a returning
player decodes a control *pre-verbally*, no legend. **Where the game already
speaks a symbol — colour *or* icon — we speak it back.**

And it reaches one axis further still — past colour and icon to **persona**. The
Help affordance wears **Tazuna**, the game's own guide-NPC (see
[ui-surfaces.md](ui-surfaces.md#the-menubar-persistent-chrome-over-the-canvas)):
players reach for the character who *shows them the ropes* in-game to be shown
them here. Same rule, one more axis.

### 6. Informs, never enforces — down to the chrome

The product stance from [architecture.md](architecture.md), extended into the
view layer:

- Negative balances render as **information** (pressure points), never errors or
  nags. (The prototype's red "deficit" outline on over-budget inputs drifts toward
  *enforcing* — reframe as informing.)
- The staleness desaturation is an **ambient nudge** to re-anchor, not a blocking
  prompt: the world quietly dims and you update when it bothers you.
- Even the app's own chrome doesn't seize control — the world stays grabbable
  while overlays are open (principle 1).

### 7. State flows one way; the DOM is never the source of truth

The prototype's actual mud was a **global `CustomEvent` bus + per-view manual
`refresh()` fan-out**: one listener hand-called `setSpend → buildProjection →
refreshTimelinePulls → sidebar.refreshPulls → navbar.refresh →
minimap.refreshBalance`, and adding a view meant finding and editing that list
forever. Worse, the DOM *became* the state (plan values, available-pulls, focus
all read back out of nodes).

The rebuild rule: an input change fires **one** recompute on the coordinator;
views are **pure functions of the resulting projection** and **subscribe** to it;
**no view touches another view**, and **no state lives in the DOM** — it flows
*out* to the DOM, never back. This is "the lesson frameworks teach, kept without
the framework."

### 8. Layout is contained, pure-where-possible geometry

The packing logic is the one genuinely algorithmic chunk of UI, and it must be
**contained**, not sprinkled across views as `getBoundingClientRect` calls (the
prototype's sprawl). The clean shape:

1. Render cards, **measure heights once**.
2. A **pure geometry function**: `(x-positions, heights) → offsets`. No DOM, no
   measurement — just the packing math. **Headless-testable.**
3. Apply the result as transforms, set inline from JS — geometry driven by the
   axis/pan/packer is JS-owned, static layout and theme are CSS-owned (see
   *Styling* in [conventions.md](conventions.md)).

It is **one layout module with two lane strategies**, and that asymmetry is
*correct* (different semantics, different data shapes):

- **Above:** group-by-shared-start + horizontal nudge to fit; date on the group.
- **Below:** vertical collision-stacking (tallest-first, fill gaps); each card on
  its own date.

> Capture wanted in a future session: the prototype's pack — did it ever visibly
> misbehave (bad packing on a dense week, jitter on recompute)? Those become the
> test cases the pure packer must pin.

### 9. Target: 1080p desktop / capable tablet; phone degrades

- **Primary:** 1080p desktop, modern browser. **Secondary:** a reasonable tablet.
- **Phone:** graceful degradation only — "collapses into sort-of-usable" is the
  bar; don't spend design budget on a phone-specific layout, just don't *break*.
- **Touch is first-class** (tablet): all pan/inertia gestures (horizontal *and*
  the vertical excursion below) work mouse *and* touch.
- This puts a **concrete floor under "the budget is the user's device"** — the
  perf affordances (virtualization, blur cost) are judged against a capable
  device, not a low-end phone, so several can stay parked.

### 10. The unit of spend is pity, not pulls

A **pity is a guaranteed acquisition**; a **pull is a gamble**. You plan in
guarantees, never gambles — the planning frame is *"I need one copy of this or I'm
stuffed,"* not "budget 199 carats and maybe walk away with nothing." **A 30-pull is
not a plan, it's a lottery ticket** — and you don't budget in lottery tickets.
This sits on principle 3 (the spend axis) and principle 6 (inform, don't enforce),
and it is the unit that the plan, the minimap, and the banner all share.

- **Commit in pities; derive the cost.** The player's native unit *is* pity, so
  commitment is entered in pities and the carat cost is *derived* from it
  (persist-intent → resolution, [projection.md](projection.md)). "Type a 1 instead
  of 200" — the convenient, game-native input. **Carats are the substrate; pity is
  the unit of account the human reads and writes.** This is principle 5's borrowed
  grammar, hardened into the unit itself.
- **One unit, everywhere.** The minimap axis is fretted in pities (30k carats ≈ 1
  pity), bounded to ±3 pity (the community's guaranteed-MLB envelope); the commit
  input (at source, on the banner) is in pities; the cost/pity pills read in pities.
  Input and display agree.
- **Inform against the resource streams.** The site's job is to say whether the
  player's combined income streams (logins, missions, CMs, …) can *meet the pity
  targets* — reconciling income against pity-denominated spend. It informs; it
  doesn't promise the gamble pays off.
- **Winning early closes the loop.** If the copy drops before pity is reached, the
  player updates account state (re-anchors the snapshot) and **unfavourites the
  target — done**. The favourite is the standing "I still need this"; acquisition
  retires it. (This is why bookmarks are future-only and scarcity-legible — the
  list *is* the set of open acquisition targets.)

> Open (from user testing): pity vs pulls as the *input granularity* — a clubmate
> found the pity/pull distinction unclear at first but liked the pity mechanism
> once it clicked ("easier to type a 1"). The model is right; the **label** was
> missing. Whether the input box is pities or pulls is a presentation call, still
> open; *pity as the unit of account* is not.

---

## Roadmap

**All surfaces are captured and the view layer is built.** What remains:

- **Open threads inside captured surfaces** — flagged inline with `> Open`
  callouts throughout [ui-timeline.md](ui-timeline.md) and
  [ui-surfaces.md](ui-surfaces.md): the pity-vs-pull input *label* (principle 10),
  how to render source-density on a compact banner, the minimap positive-band
  buffer, EC3 pill ordering.
- **Cross-side ETL dependencies** (search, free pulls) — tracked on the GitHub
  board (`sldsmkd/horsetrader`). Frontend consumes; don't action from a frontend
  session.
- **Parked features** — PvP income wiring (#61); bookmarks name disambiguation
  (#46); the "now" panel (#20); Tazuna / help surface (#29).

## See also

- [ui-timeline.md](ui-timeline.md) — timeline, lanes, minimap, rushable events.
- [ui-surfaces.md](ui-surfaces.md) — banner card, bookmarks, menubar, search,
  menu surfaces, dev panel, plan, layout edge cases.
- [engine.md](engine.md) — the coordinator API (the seam this layer consumes).
- [architecture.md](architecture.md) — the no-server driver, the layering rule.
- [menu.md](menu.md) — the menubar, Identity, Resources, and Tazuna in detail.
- [projection.md](projection.md) — the ledger and fold every view renders.
- [persistence.md](persistence.md) — the inputs the input surfaces collect.
- [conventions.md](conventions.md) — `h()` helper, unidirectional flow, typed
  data-access, no-framework discipline.
- [trust-and-failure.md](trust-and-failure.md) — the visible-error-panel and
  fail-soft model the UI must honour.
