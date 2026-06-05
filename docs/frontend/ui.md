# UI (the view layer)

How the site *presents itself*: the timeline substrate, the surfaces that float
over it, and the principles that keep the view layer honest. This is the layer
[the README](README.md) deliberately deferred — it sits on top of `core/`
(persistence + projection) and is a pure consumer of the **coordinator seam**
(`projection`, `balanceAt`, `channels`, `document`, `recovered`, `update`,
`setEnabled`). Pair with
[conventions.md](conventions.md) (language, layering, DOM patterns) and
[architecture.md](architecture.md) (the no-server driver and the layering rule).

## ✅ Status: all surfaces captured — intent foundation complete (pre-code)

This doc was built **intent-first, surface by surface**, distilling lessons from
the old prototype (`_horsetrader.old/site.old/`) before any `ui/` code is written.
It is **not about appearance** ("widgets are navy") — it is about *intent*: why a
surface exists and what it makes legible. As of **2026-06-02 every surface is
captured**: the principles below are the settled foundation and the per-surface
deep-dives all landed. What remains is open *threads* (flagged inline) and turning
this into `ui/` code — see [Roadmap](#roadmap).

- **Captured:** the spine (below), the timeline substrate, the two lanes,
  transaction timing (last-day posting + rushable events), the banner card
  (above-lane contents: pills, favouriting, borrowed rarity grammar, the resource
  readout, the value highlight), bookmarks (favourites as navigation), the menubar
  (persistent chrome + the shared warp primitive), search (find-and-warp), the
  account overlay (snapshot + income config), the dev/debug panel (force-date
  interlock + devdots), the what's-new overlay (minimal, deferred), the plan
  (read-only, commitment-scoped), pity as the unit of account, the three layout
  edge cases, the target-device constraint.
- **All surfaces captured** as of 2026-06-02 — the plan was the last. What
  remains is open *threads* inside captured surfaces (flagged inline) and turning
  the intent into `ui/` code. See [Roadmap](#roadmap) at the foot.

---

## The spine

Ten principles, in dependency order. Everything else hangs off these.

### 1. The timeline is the persistent substrate, not a "screen"

There is **one canvas, always mounted, always interactive** — a horizontal,
grabbable, inertial time-as-x world. It is the core representation *and* the
primary navigation of the whole site. Everything else (search, account, the plan,
a card lightbox) is a **non-blocking overlay floating over a still-live canvas**:
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
  [the what's-new overlay](#the-whats-new--changelog-overlay)). The single tolerated
  breach anywhere is the dev panel's native `alert()` — an **intentional, dev-only**
  break of this contract, never on a product surface.
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

> Resolved (lean): the [account overlay](#the-account-overlay) settles this —
> income is configured **parametrically and globally** (ranks, a single CM target
> tier, a login cadence), *not* via per-event below-lane toggles. The below lane
> stays **passive sources**; per-instance reconciliation rides the
> [rushable toggle](#rushable-events-the-opt-in-inversion) instead. The P&L frame
> was the right way to reason about it; the answer is "no new below-lane input."

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
  [the banner card](#the-banner-card-above-lane-contents)). This is a stronger
  rule than "colour carries meaning": **mirror the upstream grammar so no legend
  is needed** — a returning player decodes gem/gold rarity pre-verbally because
  it's the same language they already read in-game. Same instinct as principle 3
  rendering concurrent scouts the way Cygames groups them.

The *palette itself* is appearance and is **not** pinned here; the rule —
colour carries meaning, and where the game already speaks a colour we speak it
back — is.

This **generalises past colour to *symbols***. Control icons are sourced from the
game's own in-game **touch buttons** (Cygames ships them with the client — which
is why placeholders dropped into the skeleton look like mobile-app buttons:
because they *are*), then cleaned in **Aseprite** — rescaled, touch-affordances
stripped — so a returning player decodes a control *pre-verbally*, no legend,
exactly as they decode a gem/gold pill. **Where the game already speaks a symbol —
colour *or* icon — we speak it back.** (The menubar's current icons are
placeholder emoji standing in until the real set lands. The Aseprite cleanup is
the principle-4 instinct applied to assets: keep the recognisable gist, drop what
doesn't serve a dense desktop view.)

And it reaches one axis further still — past colour and icon to **persona**. The
Help affordance wears **Tazuna**, the game's own guide-NPC (see
[the menubar](#the-menubar-persistent-chrome-over-the-canvas)): players reach for
the character who *shows them the ropes* in-game to be shown them here. Same rule,
one more axis — where the game already speaks a symbol *of any kind*, we speak it
back.

### 6. Informs, never enforces — down to the chrome

The product stance from [architecture.md](architecture.md), extended into the
view layer:

- Negative balances render as **information** (pressure points), never errors or
  nags. (The prototype's red "deficit" outline on over-budget inputs drifts toward
  *enforcing* — reframe as informing.)
- The staleness desaturation is an **ambient nudge** to re-anchor, not a blocking
  prompt: the world quietly dims and you update when it bothers you. Same stance
  as letting the balance go negative.
- Even the app's own chrome doesn't seize control — the world stays grabbable
  while overlays are open (principle 1).

### 7. State flows one way; the DOM is never the source of truth

The prototype's actual mud was a **global `CustomEvent` bus + per-view manual
`refresh()` fan-out**: one listener hand-called `setSpend → buildProjection →
refreshTimelinePulls → sidebar.refreshPulls → navbar.refresh →
minimap.refreshBalance`, and adding a view meant finding and editing that list
forever. Worse, the DOM *became* the state (plan values, available-pulls, focus
all read back out of nodes).

The rebuild rule (already the conventions-doc rule, now with teeth): an input
change fires **one** recompute on the coordinator; views are **pure functions of
the resulting projection** and **subscribe** to it; **no view touches another
view**, and **no state lives in the DOM** — it flows *out* to the DOM, never back.
This is "the lesson frameworks teach, kept without the framework."

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

## The timeline, in detail

### Anatomy (intent, not chrome)

Time flows left→right. Banners pinned **above** as trainee+support pairs/beats;
feed/consumption events **below**; pins/dots mark where things land; the bottom
minimap is the same axis zoomed out with the balance squiggle and favourite pips.
All views over one axis and one ledger.

### The line is an instrument

- **Up/down stems** tie each card to its exact tick (principle 4). They work;
  polish only.
- **Daily dots are derived from the ledger** — a dot means "this day has
  transactions, hover to see them," so **a day with no entries gets no dot** by
  construction (the [sparse, entry-keyed ledger](projection.md): empty days carry
  no row). Currently a debug surface (`devdots`); whether it graduates is open,
  but the transaction-day mapping holds either way.
- **The anchor bar** marks the **snapshot date** — the origin everything projects
  forward from. It makes the engine's anchor *visible*: solid/known to its left,
  increasingly grey/predicted to its right.
- **The today dot and the anchor bar are two different points** that drift apart;
  the grey-trend (principle 5) is literally a visualisation of the distance
  between *now* and *last re-anchor* — a clean mapping of an engine fact to a
  pixel.

### One ledger → many views

The detailed cards, the per-day tooltip, the cursor balance, the minimap line and
its favourite pips are **all views over the one ledger and the one fold** — no
second engine. The minimap is the proof (see [projection.md](projection.md),
[architecture.md](architecture.md)).

#### The minimap, consolidated

**The timeline does two jobs: it is *navigation*, and it *shows the player density
and pressure*.** (Principle 1 — the timeline is the primary navigation; principle 2
— spacing is information.) The **minimap is that purpose concentrated**: a
**fret-lined balance instrument** (it grew from a blank scrubber that replaced the
horizontal navbar into something information-rich) — the timeline's whole semantics
in miniature, **dots + line over the one axis and one ledger**:

- **The white line is the carat *balance* at each point in time — carats, *not*
  pities.** Carats are the substrate and a clean common proxy: the two card types
  (trainee / support) draw on **different ticket pools**, so there is no single
  pity scalar to plot; carats are the shared denominator.
- **Fretmarks sit on 30k-carat boundaries — one pity each** (usually). So the line
  is *plotted* in carats but *read* in pities — the frets do the translation
  (principle 10: carats the substrate, pity the unit of account). The display is
  bounded to **±3 pity (±90k)** — the community's guaranteed-MLB envelope — and
  **caps beyond that** to stay readable (clamp, don't run off). Frets quantise the
  balance the way frets quantise a fingerboard.
- **Dots are favourited banner appearances.** **Green** mirrors trainee-card green,
  **blue** mirrors support-card blue; a dot is placed where a favourited banner
  **appears** (its start — the appearance-dot, per last-day posting) and shows only
  **favourited** content. **The dots mirror the bookmarks exactly** — the same
  banners-with-favourites, appearing/disappearing the same way (future-only,
  favourite-derived). Minimap pips and the bookmark list are the *same* view in two
  forms.
- **The window is centred, not screen-width-derived.** The highlighted slice (the
  current canvas view) is **centred on the cursor/view**, and its width is **picked
  to be a comfortable interaction target** — *not* a literal projection of screen
  width onto the minimap scale. It's a grab handle sized for the hand, not a
  to-scale viewport mirror.
- **Together they are a density + pressure proxy.** The dot-clusters show *where
  the pressure is*; the white line *supports* it with the balance trend — both
  readable at a glance.
- **Colour carries the sign.** **Blue above the origin** (healthy); the line turns
  **red on a negative balance** — a **danger to the plan**. Consistent with
  principle 6: red is *danger information*, not an error or a nag (you're allowed to
  go negative; the colour just makes the pressure legible).

> Open: the positive band may want to start **one pity above** the origin rather
> than at zero — a small buffer so "scraping zero" already reads as caution, not
> only an outright deficit.

### Transactions post on their last day (the line lags the dots)

A **core/projection semantic** with a load-bearing UI consequence (the engine rule
lives in [projection.md](projection.md); captured here for its visual effect and
the lesson behind it):

- **Everything debits/credits on the *last day it runs*, not the first.** A
  Championship Meeting pays out at the **end** (reward set by final placement); a
  story is grinded ambiently and its rewards land when it **finishes**; a banner is
  most efficiently spent at its **end**, because by then you've accrued the
  window's tickets + daily + free pulls and minimised raw carat spend. The realised
  moment *is* the last day.
- **Exception: sequences/generators** post **multiple discrete transactions**
  rather than a single end-post.

**The dot and the line sit at different x — by design.** The **dot marks the
banner's *appearance*** (its start); the **balance line reacts at the banner's
*end*** (last-day posting). So **the line *lags* the dot** — that gap is the
*correct, intended* consequence of the rule, not a defect. The prototype's wrong
turn was trying to **model complex plans** to smooth it; the simple last-day model
is right. And on reflection **the lag itself is acceptable** — players read it as
*how the instrument works* and internalise it; it is not a problem to engineer
around.

> Resolved (lean): the lag is **accepted as-is**. Making it more legible (e.g.
> visibly tying a banner's appearance-dot to its later balance-reaction) is at most
> **low-priority polish**, never a model change — and likely unnecessary.

> Lesson (a sibling to principle 7's anti-mud): the urge to model complex plans was
> the **wrong instinct**; the simpler "post at the end" was the **original,
> correct** one — and supporting it cleanly was worth a **deliberate break in
> core**. Principle-4 judgment: don't build elaborate machinery; keep the semantic
> that lets the view stay honest.

### Rushable events (the opt-in inversion)

The default is last-day posting; **rushing is the player's opt-in inversion of it**,
and the *semi-fix* for the lag above. Some events are **rushable**, some aren't (a
per-event property — **needs upstream/ETL marking**). The marking is an *optional*
flag: read it `ev.rushable === true`, absence means not rushable (the
[contract's optional-flag convention](../contract.md#optional-flags-presence-encoded-absence-defaulted)).
Toggling a rushable event
into a **rushed** state **flips the semantics**: rewards/costs post at the **start**
instead of the end, **at an efficiency cost**.

- **Rush a banner** → spend all upfront, but forfeit the free pulls / daily pulls /
  maybe some tickets you'd have accrued by waiting to the end.
- **Rush a story** → the player going ham, grinding it out early.

> The efficiency-cost computation (what you forfeit by rushing) is **core/projection
> logic, not UI**. This whole feature **needs upstream work** — ETL to mark which
> events are rushable, core to model the rushed (start-post + penalty) semantics.
> The UI part is the **toggle** and showing the flipped state; flagged as a
> cross-side dependency, not actioned in this frontend session. The data cost is
> nil: the event corpus is tiny (~1000), so a per-event `rushable` bool on the
> subset is free — no clever encoding (reinforcing principle 9: at this scale the
> data side is never the bottleneck; don't over-engineer it).

It is another **stored input on the atom** (a per-event toggle, persist → derive —
principle 7), and pure **principle 6**: it *shows* the efficiency cost, it never
blocks the choice. And it only **semi**-fixes the lag — a rushed event's line
reacts at its start-dot (lag collapses), but it's opt-in and costs efficiency, so
you'd never rush *just* to fix the display; the default last-day case keeps the
parked legibility problem.

**Two use cases:**

1. **Reconcile with reality — "I've already finished that."** A story realistically
   gets done ~halfway through its window (engagement- and red-bull-dependent), so
   the player marks it rushed to post the rewards *when they actually landed them*.
2. **Opportunity cost & what-if planning.** Rush a banner because the unit is meta
   for tomorrow's PVP (worth the hit); or explore a counterfactual — *"the planner
   says I can't afford it, but if I grind like mad, can I make it work?"* This makes
   the **planner a hypothetical-explorer, not just a recorder** — toggles let you
   probe counterfactuals, not only record what happened.

---

## The banner card (above-lane contents)

The above-lane card is the **marketing-beat container** (principle 3): concurrent
scouts share one card, the date sits on the container, not per-item. *What the
card contains* is the interesting part — and the governing idea is that **the
banner is plumbing, the contents are the point.**

The **container date itself carries the grey trust-language** (principle 5): a
*predicted* future banner greys its date, exactly as predicted event dates and the
staleness trend do elsewhere — same grammar, composed onto the above-lane. No new
mechanism; the whole banner reads as lower-trust through its date.

### The banner is a delivery mechanism; intent lives on the atom

A player is not emotionally invested in a banner — they want **the card or the
trainee it delivers**. So every truth-bearing and intent-bearing thing attaches to
the **content**, never the container:

- Contents render as **pills** — one pill = **exactly one atom** (one trainee or
  one support card), never a bundle.
- **Favouriting (the star) lives on the pill, not the banner.** You star the thing
  you want; the banner is just how it arrives. The star is **two-state** — an empty
  outline (☆) vs a **filled/gold** active star — so "I've signalled intent on this
  atom" is legible at a glance.
- **Banner value is *derived*, never declared.** "This banner happens to deliver
  three of my favourites" is an emergent, computed property of its contents —
  surfaced if useful, but incidental. This is the [ledger](projection.md)
  philosophy applied to favourites: store the atomic intent, derive the rollup;
  never let the user favourite the container and throw the granularity away.

A starred atom then becomes a **favourite pip on the minimap** — favourites flow
*out* to a timeline view (the "one ledger → many views" thread), answering "where
do the things I care about land." Favourites are a stored input
([persistence.md](persistence.md)).

### Pills speak the game's colour grammar (principle 5, borrowed axis)

Each pill carries two signals lifted **verbatim from in-game card art**, so they
read before a word does:

- **Rarity → border / surround**, as a precious-material ladder mirroring the
  in-game frame:

  | Tier | In-game frame | Reads as |
  |---|---|---|
  | SSR / 3★ | purple TL · blue TR+BL · green BR | **gem / crystal** |
  | SR / 2★ | gold + white highlight | **gold** |
  | ~~R / 1★~~ | grey + white highlight | **silver** — *not rendered* |

  **R is culled at the content layer.** R cards are chaff — incidental pulls, never
  a thing you plan a spend *for* — so the above-lane only ever shows **gem + gold**.
  This is a deliberate typed-subset drop (principle 2's *legibility over density*,
  and a debug-level drop, not a warned surprise), and
  it has a useful side effect: **grey-as-rarity never appears here, so grey stays
  unambiguously the *trust* language** (principle 5) on this surface — no channel
  collision to engineer around.
- **Attribute → pill icon**, mirroring the support card's in-game type badge.

Exact frame-mirroring is **not** required: pills are small, and *gem > gold* is a
legible ranking from the materials alone. Capturing the gist is correct — the
principle-4 instinct (*approximation accepted; don't build elaborate machinery to
reproduce four corners on a 20px pill*).

### The resource readout (projected total; sources as density)

The banner also carries a **resource number** — *how many pities/pulls I'll have by
the time this banner lands*. That number is **`balanceAt(bannerDate)`** (principle
10's unit): the **income fold surfaced at the spend point**. So one card shows
*both* sides of the P&L meeting — the **sinks** (the pills you'd spend *for*) and
the **projected source-total** (what you'll *have* to spend). It's the same fold
the minimap frets, read at this card's x instead of scrubbed.

**The four source streams.** A banner can only be spent on with these, and their
sum *is* the total pulls:

| Stream | What it is | Note |
|---|---|---|
| **Gift pulls** | free pulls granted by events | pending ETL reintegration (live tracker: GitHub issues / board on `sldsmkd/horsetrader`) |
| **Carats** | premium currency | *converted* to pulls — carats are the substrate (principle 10) |
| **Paid daily pulls** | the discounted daily single | |
| **Tickets** | scout tickets | |

The loop closes across the line: **below-lane events *grant* into these four
streams** (a card's reward-breakdown pills — e.g. a story event paying out carats,
tickets, daily/gift pulls — are amounts flowing *in*), and the streams **sum to the
readout** shown on the above-lane banner. That is principle 3 made literal —
below-lane **sources** feeding the above-lane **sink's** affordability — and it is
the income signal EC1 says below-lane card height must carry.

**Reflect the density; don't flatten to a scalar.** The old planner decomposed the
total into exactly these streams (which sum: 0 + 13 + 35 + 243 = 291). That
decomposition *is information* — principle 2's **density**, principle 3's
**sources** — so collapsing it to one bare digit throws away signal. The
composition should stay **legible on the banner**, not vanish in the
simplification.

**…but count everything, itemise only what's worth a glance.** The bracket on the
rule above: there is a **floor**. Micro-streams — e.g. the **80 free carats** you
get when a new trainee joins the academy on a narrative beat — are *real income*
(they enter the fold and move the balance) but **too small to deserve their own
labelled source**; surfacing them is noise, not signal. They **aggregate into a
coarse bucket** (folded in with dailies / a catch-all minor-income line) —
**counted, not itemised**. This is a **display-aggregation rule, not a data drop**
(the income is fully modelled); principle 6 (inform, don't overwhelm) meeting
principle 2 (don't itemise chaff), the same quiet long-tail handling as a
debug-level drop. So the four streams are the *surfaced* granularity; below them,
the tail folds up.

> Open: (1) **how** to reflect source-density on a compact banner — a
> segmented/stacked readout, a breakdown on hover/expand? (form unsettled). (2)
> The **display unit** — the readout currently reads in *pulls* (the dice, 291),
> but principle 10 makes *pity* the unit of account; this is the **same open
> question** as principle 10's input-granularity note. (3) The **cost/pity pills**
> proper (what a pull/pity *costs* — carrots — as distinct from what you *have*).
> (4) **Gift pulls** — pending ETL reintegration (live tracker: GitHub issues /
> board on `sldsmkd/horsetrader`); the readout
> consumes the field once it lands.

### The value highlight (intrinsic "good place to pull")

A **subtle glow** on the banner is the **value highlight** — and it carries a
*second, distinct* notion of value from the favourite rollup. Keep them separate:

- **Personal / derived value** — "how many of *my* favourites does this deliver"
  (the favourite rollup above). Player-specific.
- **Intrinsic value** — "this is objectively a **strong place to pull**,"
  independent of the player's favourites. This is what the glow signifies: **the
  *banner's* value, not any one card's** — even when it renders on/around a pill
  (here, the meta card that anchors the value).

The signal **boils down to one number: the banner's free-pull count.** Anniversary
/ scenario beats bundle a meta support card *and* dump free pulls, so free pulls
turn out to be a clean proxy for "good value." This was **researched extensively
ETL-side** — correlated against a competitive JP player's writeup of the strong
cards and *why* — and captured in [domain.md](../domain.md) ("Scenario /
anniversary beats always bundle a meta support card"). We keep it as a **strong,
simple signal**: *good place to pull.*

- **Principle 6** (informs — nudges toward a good spot, never enforces) and
  **principle 5** (the glow is a value *language*, meaning not decoration).
- **Derived from ETL truth, reduced to a simple rule.** Resist re-deriving the meta
  in the UI; the free-pull count already carries it (the work is done upstream).
- **Needs the same free-pull number** as the resource readout — pending ETL
  reintegration (live tracker: GitHub issues / board on `sldsmkd/horsetrader`);
  the glow consumes it once it lands.

---

## Bookmarks (favourites as navigation)

The bookmark list is what **favouriting feeds**, and it serves *two* purposes —
one convenience, one strategic:

1. **Navigation** — the answer to principle 2's parked problem (long empty runs ⇒
   lots of panning; *the fix is navigation, never compressing the axis*).
2. **Scarcity legibility — "do I only have one shot at this?"** Listing *every*
   future instance of a favourited atom tells the player whether this is a
   now-or-never spend or whether the card comes back. One future occurrence on the
   horizon vs five completely changes the spend *urgency* — this is the biggest
   single input to "commit now or wait," and it's principle 3's P&L reasoning made
   navigable (and principle 6: it *surfaces* the scarcity, it doesn't nag you to
   act).

It is a **derived view, not a managed list** — the favourite is the single source
of intent, bookmarks are a pure function of it (principle 7; the same
derive-the-rollup move as "banner value is derived").

- **Star → it and all its *future* instances** on the timeline join the list;
  unstar → they all leave. You never edit a bookmark entry directly; the atom's
  star is the only control. One input, fanned out across the timeline.
- **Future-only, by design.** Past instances are dropped from the *view* — "it's
  gone; the player doesn't care about the past." This is a **navigation-list
  filter, not data culling**: the engine still holds past events (see the
  don't-prematurely-cull stance in [projection.md](projection.md)); the nav
  surface simply won't point backwards.
- **Each row is a warp control** — click to jump the timeline view to that exact
  instance. This is the **list-twin of the minimap's favourite pips**: the same
  favourite intent rendered as two views (scrollable list + pips), both over the
  one timeline ("one ledger → many views").
- **Co-occurring favourites combine into one row** with a shared date range (two
  starred atoms landing on the same beat → a single entry) — the **marketing-beat
  grouping** (principle 3) showing through. Row dates carry the **grey
  trust-language** when predicted (principle 5).

Together with the minimap, bookmarks are *how you traverse a true-to-date axis*
without ever compressing it — navigation does the work the axis refuses to.

**Panel chrome.** The list lives in a **collapsible docked drawer** — an
expand/collapse **tab** (chevron) summons and dismisses it. It is a non-blocking
overlay (principle 1): collapsed, it keeps the canvas clear; it never owns the
screen. **Empty state:** with no favourites the drawer collapses to a *greyed-out*
expand tab — empty is a **quiet inactive state, not an error** (principle 6); with
nothing to navigate to, the surface simply recedes. (That grey is *inactive
chrome* — the universal disabled-control convention, on the tab not on data — a
distinct channel from grey-as-trust in principle 5; named here so the grey grammar
stays honest.)

---

## The menubar (persistent chrome over the canvas)

The top bar is **always-mounted chrome floating over the live canvas** (principle
1): it never owns or blocks the timeline — the world stays grabbable beneath it.
It sits at the timeline's x-origin so its readouts read as **state sampled at
where you're looking**, not free-floating numbers. Left → right:

- **Home — a warp to *today*.** It is **the one permanent
  [bookmark](#bookmarks-favourites-as-navigation)**: the same accelerated-but-
  smoothed inertial scroll a bookmark row fires, with `today` as a fixed target
  that exists even at zero favourites. The world *travels* there (you see what you
  fly past) — never a teleport, never a screen-swap (principle 1). It's the
  always-available answer to principle 2's parked panning problem.
- **The date chip — the date you are currently viewing.** A live readout of the
  view-centre, updating as you pan/scrub.
- **Search — a find-and-warp lens** (its own section below).
- **The plan toggle** — opens/closes the [plan](#the-plan) overlay. *(Its icon
  is a placeholder emoji — the alarm-clock glyph is not semantic; see the
  icon-sourcing note under principle 5.)*
- **The carat readout — `balanceAt(dateChip)`.** Projected carats **at the date
  you're viewing**, **linked to the date chip** so scrubbing the timeline moves
  both together. It reads in **carats — the substrate** (principle 10), *not* pity:
  the menubar is the raw-substrate sample, while the planning surfaces (the banner
  readout, the minimap frets) translate to pity. It **carries the grey
  trust-language** (principle 5), and **bidirectionally**: scroll back to the
  **anchor** (the saved account marker) and the carats render **white + bold —
  confidence**, because that balance is *known* truth; scroll forward past the
  anchor and the projected number **greys** as it leaves the known region, exactly
  as predicted dates and the staleness trend grey elsewhere. The readout doesn't
  merely fade when uncertain — it *asserts* confidence where the balance is the
  saved snapshot, and withdraws it as the projection runs into prediction.
  **Clicking it opens the [account overlay](#the-account-overlay)** — the number
  you read is the door to the input that sets it (display and its own editing
  surface, one control).
- **The avatar (Tazuna) — Help / onboarding** (hover: "Help"; *not wired in
  yet*). It wears **Tazuna**, the game's in-game secretary-guide — the NPC players
  already associate with *being shown the ropes*: she welcomes new trainers, coaches
  them (often uselessly — "skill issue") after a lost race, and hypes the gacha
  reveal. Making her the Help affordance is principle 5's borrowed grammar at its
  limit — **persona**, past colour and icon: players reach for the guide-character
  to be guided, no legend needed. The wink (her in-game pointers are famously
  unhelpful) is an in-joke, not the reason; recognition is.

The unifying thread: **Home, bookmarks, and search are all the same warp
primitive** — one accelerated inertial scroll to a target x — surfaced three ways.
And the menubar is another **"one ledger → many views"** instance: the carat
readout is the [fold](projection.md) sampled at the view date, the same fold the
minimap frets and the banner reads, here following your gaze.

## Search (the find-and-warp lens)

Search is **inline and always-present** in the menubar — finding a card or trainee
is a primary verb, not an overlay tucked behind an icon. It is deliberately
**thin: find + warp**, and it hands everything else off to the star.

- **Results stay on the live axis.** Committing a search **re-scopes the timeline
  in situ** rather than opening a separate results page — matches keep their **true
  dates**, so you read *when* they land, not merely *that* they exist. Even
  find-results obey "we're a planner, not a browser" (principle 2). *(The count —
  e.g. "27 results found" — is matching atoms across all time.)*
- **Typeahead in the game's naming grammar.** The autocomplete spans **both atom
  kinds and all alt-versions**, labelled the way the game names them (principle 5):
  trainees as bare-name + costume (`Mejiro Ramonu (Wedding)`), supports as
  rarity-prefix + name + type (`SSR Mejiro Ramonu (Power)`). You recognise the
  entity pre-verbally.
- **Progressive narrowing for big families.** The franchise is full of large
  naming dynasties — the Mejiro line alone is huge — so typing more (`mejiro` →
  `mejiro r`) cuts the field down. This collision is the edge case the surface
  exists to handle.
- **Click = warp to the first match.** Selecting a result fires the warp primitive
  to the **first/next instance** — and that's all. **Search does not enumerate
  reruns.**
- **Reruns are the star's job, not search's.** The moment the question shifts from
  *navigate* to *how scarce is this* — does it come back? how many future shots? —
  you **favourite** it, and the favourite→[bookmark](#bookmarks-favourites-as-navigation)
  derivation fans out every future instance. Rerun-enumeration lives in exactly
  **one** place (principle 7); search composes with it instead of duplicating it.

---

## The account overlay

The account overlay is **the single most important *input* surface** — where the
player tells the engine *what they have* and *how their income behaves*. It opens
by **clicking the carat readout** in the menubar: the number you *read* is the door
to the input that *sets* it — display and its own editing surface are one control.
(This resolves the open entry-point question; the avatar stays **Help/Tazuna**, not
account.) Like every overlay it floats over the still-live canvas (principle 1),
anchored under the menubar at the x-origin.

**Prior art — it mirrors the Henry Handsome Carat Calculator.** The account model
is deliberately shaped like the **community's de-facto planning spreadsheet** (the
widely-shared *Henry Handsome Derby's Carat Calculator*): the same inputs players
already fill in — Team Trial / Club / Champion's Meeting / League of Heroes tiers,
Daily Carat Pack, Training Pass, monthly income, crystal/shard balances, per-banner
carat estimates and MLB odds. Anyone who already plans has **been taught these
concepts**, so the surface costs them no new vocabulary. This is principle 5's
meet-them-where-they-are instinct **one level up**: not borrowing the *game's*
visual grammar but the **community's learned planning model**. It also makes
principle 2 / [architecture's](architecture.md) "edge over a spreadsheet" concrete
— *this* is the spreadsheet; horsetrader is its better-UX, true-to-date successor.

It holds **two stacked concerns**, and the split matters.

### Balance — the snapshot (re-anchor)

Headed **BALANCE ON <date>**, this *is* the **anchor** the engine projects forward
from (the [anchor bar](#the-line-is-an-instrument)). Re-anchoring = updating it to
today — exactly what the staleness grey-trend gently nudges toward (principle 6),
and why the carat readout reads white/bold here (known) and greys into the future
(predicted).

**First run — the empty balance is a CTA.** A brand-new player has never set a
balance, so there is no anchor and nothing to project. That empty state turns the
carat readout into a **call to action** — an invitation to set up, the app's
**bootstrap input**. It is the one empty-state that *invites* rather than recedes:
contrast the [bookmark drawer](#bookmarks-favourites-as-navigation), which greys
and recedes when empty ("nothing to navigate to"). Both are principle-6 honest
(inform, never nag), but the snapshot is the single **load-bearing** input the
whole projection hangs on, so its absence earns a gentle prompt, not silence.
(Pairs with the Tazuna/Help onboarding beat.)

Crucially the balance is **decomposed into the real in-game resource pools**, not a
single scalar:

- **Carats — free vs paid** (the paid split is what the *whale / include-paid-pulls*
  config below toggles on).
- **Rainbow (SSR) and Gold (SR) — uncap copies + shards** (the limit-break
  currency).
- **Tickets — trainee vs support**, the two *separate* scout pools.

This decomposition **is the evidence behind the minimap's carats-not-pities
choice**: trainee tickets ≠ support tickets, rainbow ≠ gold — there is no single
pity scalar, so carats are the shared denominator the balance line plots. The
account surface is where the player enters the pools; the
[projection](projection.md) collapses them to the carat substrate for the line, and
the frets translate back to pity (principle 10).

### Configuration — the income model

The lower half parameterises **how much each income stream generates** — the
sources (principle 3) the banner readout sums and principle 10 reconciles spend
against:

- **Team Trial / Club rank** and **Champ. Meet target tier** — recurring PvE
  payouts scale with the tier you assume you'll place at (a CM's reward is set by
  final placement — see
  [last-day posting](#transactions-post-on-their-last-day-the-line-lags-the-dots)).
- **Daily Pack (active + days)** — the discounted daily single, one of the four
  streams.
- **Weekly Login cadence** — the login-reward pattern.
- **Monthly passes** (Friendship / Silver / Gold / Rainbow) — recurring purchases
  that feed the streams.
- **Whale → include paid pulls** — whether paid currency counts toward
  affordability.
- **Dev → Open advanced…** — the door to the
  [dev/debug panel](#the-dev--debug-panel-developer-tools) (stream toggles, devdots).

These are **stored config inputs** ([persistence.md](persistence.md)); **Save**
commits balance + config together and fires **one** recompute (principle 7), after
which every view re-derives.

> Leans resolved — principle 3's open question. The income config is **parametric
> and global** (ranks, a single CM *target tier*, a login cadence), *not* a set of
> per-event below-lane toggles ("did I run *this* CM?"). The below lane stays
> **passive sources**; per-instance reconciliation rides the
> [rushable toggle](#rushable-events-the-opt-in-inversion) ("I already finished that
> story"), not a separate did-I-run-it input.

> Forward-pointer: the [Henry Handsome calculator](#the-account-overlay) also
> carries **League of Heroes** and **Training Pass** rows (dated "Implemented
> Jan/Aug 2027" as Global catches up). Horsetrader's config will likely grow to
> match — but **League of Heroes is ETL-unmodelled today** (a quarterly PvP that
> replaces a CM), so it's a cross-side dependency, not a frontend-only add.

---

## The dev / debug panel ("Developer Tools")

A **grab-bag of developer/debug utilities**, deliberately held to a *lower bar*
than the product surfaces — where ephemeral switches live, not a designed
experience. Reached via the **hammer icon** (the account overlay's *Dev → Open
advanced…* door); there's an in-game hammer/tool asset to source for it (principle
5), not the placeholder. Like everything else it's a non-blocking overlay
(principle 1). What's in the bag today:

- **Daily P&L dots** — toggles the [devdots](#the-line-is-an-instrument), the
  per-transaction-day dots on the line. This is the home of that
  graduation-undecided debug surface; the toggle is **ephemeral** (a view switch,
  not persisted state). *(Stream toggles — the coordinator's `setEnabled` channels
  — belong here too.)*
- **Force date** — override "today" to an arbitrary date, to test the projection /
  prediction at any point. **Interlock: while a forced date is set, account saving
  is disabled** — a debug clock must never be able to **poison the real snapshot**
  (you would re-anchor against a fake today). The amber warning *informs*
  (principle 6); the interlock makes the unsafe action *impossible*, not merely
  discouraged. Clearable back to the real clock.
- **Data — Export / (Import) / Reset.** Export dumps the persisted state **as
  JSON**, primarily a **support affordance**: a user who hits a problem exports it
  and sends it over for the author to inspect. A matching **Import** (restore from
  JSON) probably wants to exist for the round-trip. It doubles as the user's **own
  backup**: a no-account/no-server app has no cloud save, so export-to-keep /
  re-import is the only safety net — left entirely to the player's discretion, never
  nagged (principle 6). Reset wipes — the destructive inverse of
  [snapshot entry](#balance--the-snapshot-re-anchor). (Export likely
  shares a serialise primitive with the [plan's](#the-plan) shareable link, but
  its *purpose* is diagnosis, not sharing.)
- **Apply** commits the panel's changes (one recompute, principle 7).

> Low-rigor by design: this surface is a utility belt, not a captured product
> intent — the contents are free to churn, and the data tools **pop browser-native
> alerts**, tolerated *only here*. A native `alert()` is a **blocking modal** —
> against principle 1's "no modal lock, the canvas stays live" — so it is the named
> dev-only exception, **never** acceptable on a product surface. The one
> *load-bearing* rule is the **force-date ↔ saving interlock**: debug state must
> not be able to corrupt real persisted state.

---

## The what's-new / changelog overlay

**No real design yet — deliberately minimal.** The current lean is a **popover that
does *not* steal focus**, containing release notes / a bug-and-feedback funnel —
consistent with every other overlay (non-blocking, the canvas stays live, principle
1). Contents and trigger cadence are unsettled; the only decision so far is *don't
make it a modal*. Its persistence hook (a stored "last seen version" vs current) is
the same machinery the account [export](#the-dev--debug-panel-developer-tools) and
the [plan's](#the-plan) shareable link reuse.

> Resolved: the focus-taking exception is **retired**. Nothing takes over the user's
> ability to scroll the timeline — what's-new **floats in front until dismissed**
> like every other overlay; it may be front-and-centre (and dim the canvas) but it
> never locks the scroll. The no-modal rule is now **absolute** (the only tolerated
> breach anywhere is the dev panel's native `alert()`s, and those are dev-only).
> [Principle 1](#1-the-timeline-is-the-persistent-substrate-not-a-screen) updated to
> match.

---

## The plan

Despite the prototype's "PLANNER" header, **this surface does not plan — it is the
*materialised plan*, read-only.** *(Terminology: **the whole application is "the
planner"** — principle 2's "we're a planner, not a browser"; **this surface is "the
plan"**, its read-only materialised output. The doc uses the two senses
deliberately.)* The post-prototype lesson pulls the **act of
committing out of it entirely**: **you don't edit here.** Commitment is entered **at
source** — on the banner, alongside the favourite star (the "intent lives on the
atom" move) — and this surface is purely the **rendered confirmation** of what that
built. The data path stays fixed (persist intent → re-resolve each recompute,
[projection.md](projection.md)); commitment is denominated in **pities** (principle
10). Its job is twofold: **let the player fully confirm what they've built**, and
**jump back to any piece to change its commitment level** (you alter it at source,
not here).

### Commitment-scoped, and a derived view

- **It shows only what you've *committed* to** — not every favourite, not every
  banner. No commitment, no row. This is the sharp line between it and the
  [bookmark drawer](#bookmarks-favourites-as-navigation): the drawer lists **all
  favourites** (navigation + scarcity); the plan lists **only commitments**
  (confirmation). Same derive-from-intent DNA, different scope.
- **Each row is a warp control** (bookmark DNA) — selecting one **jumps the timeline
  to that banner**, which is *how you go alter* the commitment at its source. But the
  plan sits **front-and-centre**, so the target lands **behind** it — precisely why
  you **jink** (principle 1). **The plan is the concrete origin of the scroll
  invariant**: it warps the very timeline it covers, and you peek without dismissing
  it.

### What each row shows

- **The source breakdown of your pulls** — per committed banner, the **four streams
  itemised**: TOTAL and its GIFT / DAILY / TICKET / CARAT decomposition (an empty
  stream greys to inactive — e.g. no tickets → grey "0"). This is where the
  [banner readout's](#the-resource-readout-projected-total-sources-as-density)
  "reflect the density, don't flatten to a scalar" open question gets **answered**:
  the plan is the surface that lays the four streams out in full.
- **Expected-copies stats** — *"how many copies should I expect?"*: a probability
  distribution over outcomes (None / 0LB / 1LB / 2LB / 3LB / **MLB**) for the
  committed pulls. This is the **one place the gamble surfaces**, and it stays honest
  to principles 10 + 6: you commit in **pities** (guarantees), and the stats show the
  *probabilistic upside* (the limit-breaks those pulls might also yield). It
  **informs the odds; it never promises** the gamble pays off.

### The plan is a shareable artifact

Read-only output built **to be shared for feedback** — *"here's my plan, is this
good?"* — which is also the growth loop. Two channels, and they want different things
from the layout:

- **A serialised link** — commitments + favourites encoded into a URL: clickable,
  re-openable, and the actual growth driver (it brings the viewer *back into the
  app*). For a no-account app this is a **new persistence requirement**, reusing the
  same serialise machinery as the [dev export](#the-dev--debug-panel-developer-tools)
  and the [what's-new](#the-whats-new--changelog-overlay) last-seen-version.
- **A plain screenshot** pasted into Discord — the **low-friction, dominant**
  real-world path (no feature needed; players already do this). Its implication is
  load-bearing: **the plan must read as a *static image*** — the headline
  (commitments, source breakdown, expected copies) legible in **one shot**, not
  hidden behind hover/scroll/interactivity. If the essentials need a pointer to
  reveal them, the screenshot is useless.

So the link is the richer/clickable channel and the screenshot is the default; both
point at the same read-only artifact — **design it screenshot-first.**

> Resolved (lean): the plan and the
> [bookmark drawer](#bookmarks-favourites-as-navigation) are **two distinct sibling
> views**, not one. They share derive-from-intent + warp-on-select, but differ in
> **scope** (all favourites vs commitments-only) and **payload** (navigation/scarcity
> vs source-breakdown + copy-stats + confirmation). The earlier "one surface or two"
> question lands on **two**. The clean way to hold it: **favourites are the *who &
> what*** (which atoms I want); **the plan is the *when & how*** (when they land, how
> I fund and commit to them) — the plan is the **banner-corollary of a favourite**.

> Open: the input-granularity *label* (pities vs pulls) from
> [principle 10](#10-the-unit-of-spend-is-pity-not-pulls) — a row displays both a
> pull figure and a pity figure; which unit the player *commits in* (at source) is
> still the open presentation call.

---

## Layout edge cases

### EC1 — too many events (vertical overflow)

Event-dense dates (e.g. New Year) stack the below-lane deep enough to push past
the viewport. **Invariant: the timeline line has gravity — it is the home row and
must never leave the viewport.**

Solve (structurally right): **don't truncate** (truncation hides income, and under
the P&L frame the below-lane is *sources* — hiding "what feeds me" on the busiest
weeks is exactly wrong). Instead, add a **second navigation axis**:

- Horizontal pan = the **primary** axis (time): free, unbounded — the world.
- Vertical pan = a **secondary, bounded, self-recentring** axis (stack depth):
  same grab gesture, but **rubber-banded back to the centred line**. The line has
  gravity; vertical is an excursion that always relaxes home.

Card-height reduction *mitigates frequency* but is **secondary** — below-lane card
height carries the income signal (reward breakdowns) the planner exists to show,
so don't solve overflow by starving the cards; solve it by letting the user
traverse. (Deep stacks re-open the virtualization question — decide with a
measurement.)

### EC2 — rich banners launched a day apart (horizontal crowding)

Two banners a day apart, both rich enough that the containers can't both centre on
their true x. ~once in five years. Solve: **nudge the bodies as close as possible,
keep the stems exact** (principle 4). The rejected alternative — grouping them —
is rejected because grouping is a semantic contract ("same beat"), and they
weren't. Don't force it beyond the cheap, invariant-preserving hack.

### EC3 — a banner with many contents (intra-card overflow)

A big banner (anniversary, celebration) can carry many atoms — enough pills that,
left unbounded, one card would grow tall enough to eat the viewport. **Solve: cap
the content region and make it a clipped, scrollable list inside the card.** The
card stays a **bounded object on the timeline**; only the pill list scrolls.

This *looks* like it contradicts EC1 ("don't starve below-lane card height"), but
it's the **container/atom asymmetry**, not a contradiction:

- **Above-lane card = a container *of* atoms.** Its contents are a list; a bounded
  scroll is a fine way to traverse a list, and the truth-bearing identity (banner
  art + date anchor, principle 4) stays pinned at the top while only the pills
  scroll. You don't need every pill on-screen to read what the card *is*.
- **Below-lane card = a single atom**, whose height *is* its reward breakdown — its
  own signal. Capping that would hide the signal; hence EC1's "don't starve."
  (Height is the *signal*, not the *gate*: a card's existence is the event's
  appearance, not whether it pays out. Most below-lane kinds — CMs, PvP,
  scenarios, anchors — grant nothing and still get a card; a reward-less card just
  has zero height. Visibility is opt-out — an explicit `visible: false` hides it.)

What's clipped below the fold is **not load-bearing**, because **banner value is
derived** (see [the banner card](#the-banner-card-above-lane-contents)): "delivers
N of my favourites" is a computed rollup, so the banner can be assessed *without*
scrolling through it. Ordering of the pills (e.g. float favourited atoms to the
top) is left **open**.

> Polish, not structure: the scrolled region wants a clearer *affordance* ("there's
> more below the fold"). Intent holds; the signal is an implementation detail.

---

## Roadmap

**All surfaces are now captured** (the plan was the last, 2026-06-02). What
remains is not new surfaces but:

- **Open threads inside captured surfaces** — flagged inline with `> Open`
  callouts: the pity-vs-pull input *label* (principle 10), how to render
  source-density on a compact banner, the minimap positive-band buffer, EC3 pill
  ordering.
- **Cross-side ETL dependencies** (search, free pulls, rushable) — tracked in the
  live tracker (GitHub issues / board on `sldsmkd/horsetrader`). Frontend
  consumes; don't action from a frontend
  session.
- **Then `ui/` code.** With the intent foundation in place, crystallise these
  surfaces into the view layer — the doc's whole purpose. The **implementation
  architecture** for that — the layer cake, the subscribe seam, the two-tier change
  model, the pure packer — is captured in [interaction.md](interaction.md). Build
  on `core/` through the coordinator seam ([architecture.md](architecture.md));
  state flows one way (principle 7); the packer is pure and headless-testable
  (principle 8).

## See also

- [architecture.md](architecture.md) — the no-server driver, the layering rule,
  the coordinator seam this layer consumes.
- [projection.md](projection.md) — the ledger and fold every view renders.
- [persistence.md](persistence.md) — the inputs (snapshot, config, commitments,
  favourites) the input surfaces collect.
- [conventions.md](conventions.md) — `h()` helper, unidirectional flow, typed
  data-access, no-framework discipline.
- [trust-and-failure.md](trust-and-failure.md) — the visible-error-panel and
  fail-soft model the UI must honour.
