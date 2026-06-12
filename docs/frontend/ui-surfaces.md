# UI — Surfaces

The per-surface detail for everything that lives above, around, or over the
timeline canvas. The founding principles live in [ui.md](ui.md). The timeline
substrate and lane mechanics live in [ui-timeline.md](ui-timeline.md).

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
the time this banner lands*. That number is **`availableFor(bannerKey)`** (or
`balanceAt(bannerEnd)` when uncommitted — principle 10's unit): the **income fold
surfaced at the spend point**. So one card shows *both* sides of the P&L meeting —
the **sinks** (the pills you'd spend *for*) and the **projected source-total**
(what you'll *have* to spend). It's the same fold the minimap frets, read at this
card's x instead of scrubbed.

**The four source streams.** A banner can only be spent on with these, and their
sum *is* the total pulls:

| Stream | What it is | Note |
|---|---|---|
| **Gift pulls** | free pulls granted by events | pending ETL reintegration |
| **Carats** | premium currency | *converted* to pulls — carats are the substrate (principle 10) |
| **Paid daily pulls** | the discounted daily single | |
| **Tickets** | scout tickets | |

The loop closes across the line: **below-lane events *grant* into these four
streams** (a card's reward-breakdown pills — e.g. a story event paying out carats,
tickets, daily/gift pulls — are amounts flowing *in*), and the streams **sum to the
readout** shown on the above-lane banner. That is principle 3 made literal —
below-lane **sources** feeding the above-lane **sink's** affordability.

**Reflect the density; don't flatten to a scalar.** The old planner decomposed the
total into exactly these streams (which sum: 0 + 13 + 35 + 243 = 291). That
decomposition *is information* — principle 2's **density**, principle 3's
**sources** — so collapsing it to one bare digit throws away signal. The
composition should stay **legible on the banner**, not vanish in the
simplification.

**…but count everything, itemise only what's worth a glance.** Micro-streams —
e.g. the **80 free carats** you get when a new trainee joins the academy on a
narrative beat — are *real income* (they enter the fold and move the balance) but
**too small to deserve their own labelled source**; surfacing them is noise, not
signal. They **aggregate into a coarse bucket** — **counted, not itemised**. This
is a **display-aggregation rule, not a data drop** (the income is fully modelled);
principle 6 (inform, don't overwhelm) meeting principle 2 (don't itemise chaff).

> Open: (1) **how** to reflect source-density on a compact banner — a
> segmented/stacked readout, a breakdown on hover/expand? (form unsettled). (2)
> The **display unit** — the readout currently reads in *pulls* (the dice, 291),
> but principle 10 makes *pity* the unit of account; this is the **same open
> question** as principle 10's input-granularity note. (3) The **cost/pity pills**
> proper (what a pull/pity *costs* — carats — as distinct from what you *have*).
> (4) **Gift pulls** — pending ETL reintegration.

### The value highlight (intrinsic "good place to pull")

A **subtle glow** on the banner is the **value highlight** — and it carries a
*second, distinct* notion of value from the favourite rollup. Keep them separate:

- **Personal / derived value** — "how many of *my* favourites does this deliver"
  (the favourite rollup above). Player-specific.
- **Intrinsic value** — "this is objectively a **strong place to pull**,"
  independent of the player's favourites. This is what the glow signifies: **the
  *banner's* value, not any one card's** — even when it renders on/around a pill.

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
  reintegration.

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
where you're looking**, not free-floating numbers. It is the visual counterpoint
to the minimap: top strip for local controls/readouts, bottom strip for whole-axis
summary/navigation. The detailed menubar design and terminology live in
[menu.md](menu.md); this section pins the timeline-level intent. Left → right:

- **Home — a warp to *today*.** It is **the one permanent
  [bookmark](#bookmarks-favourites-as-navigation)**: the same accelerated-but-
  smoothed inertial scroll a bookmark row fires, with `today` as a fixed target
  that exists even at zero favourites. The world *travels* there (you see what you
  fly past) — never a teleport, never a screen-swap (principle 1). It's the
  always-available answer to principle 2's parked panning problem.
- **The date chip — the date you are currently viewing.** A live readout of the
  view-centre, updating as you pan/scrub.
- **Representative Uma — Identity.** Opens the lightweight Stable Card surface:
  representative Uma, club, play style, and optional Trainer ID. This is "who is
  looking at the timeline?", not the forecasting spreadsheet.
- **Search — a find-and-warp lens** (its own section below).
- **The plan item — pending UX.** Opens/closes the [plan](#the-plan) overlay, but
  the exact affordance and icon are not settled. *(The old alarm-clock glyph is
  not semantic; see the icon-sourcing note under principle 5 in [ui.md](ui.md).)*
- **The Balance item — `balanceAt(dateChip)`.** A carat readout for projected
  carats **at the date you're viewing**, **linked to the date chip** so scrubbing
  the timeline moves both together. It reads in **carats — the substrate**
  (principle 10), *not* pity: the menubar is the raw-substrate sample, while the
  planning surfaces (the banner readout, the minimap frets) translate to pity. It
  **carries the grey trust-language** (principle 5), and **bidirectionally**: scroll
  back to the **anchor** (the saved snapshot marker) and the carats render **white +
  bold — confidence**, because that balance is *known* truth; scroll forward past
  the anchor and the projected number **greys** as it leaves the known region,
  exactly as predicted dates and the staleness trend grey elsewhere. The readout
  doesn't merely fade when uncertain — it *asserts* confidence where the balance is
  the saved snapshot, and withdraws it as the projection runs into prediction.
  **Clicking it opens Resources** — the number you read is the door to the input
  that sets it (display and its own editing surface, one control).
- **The avatar (Tazuna) — Help / onboarding** (hover: "Help"; *not wired in
  yet*). It wears **Tazuna**, the game's in-game secretary-guide — the NPC players
  already associate with *being shown the ropes*: she welcomes new trainers, coaches
  them (often uselessly — "skill issue") after a lost race, and hypes the gacha
  reveal. Making her the Help affordance is principle 5's borrowed grammar at its
  limit — **persona**, past colour and icon: players reach for the guide-character
  to be guided, no legend needed. She is the persistent answer to "what does this
  mean?", including first-run onboarding and the recurring info-circle ask from
  user testing. The wink (her in-game pointers are famously unhelpful) is an
  in-joke, not the reason; recognition is.

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
  find-results obey "we're a planner, not a browser" (principle 2). Search only
  offers actionable, active-or-future atoms; broad queries over the result cap
  collapse to a passive count like "27 results found" until the user narrows.
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

## The menu surfaces

The old account overlay split into three menu-attached surfaces. The detailed
design lives in [menu.md](menu.md); the view-layer invariant is that all three
are **non-blocking overlays** over the still-live canvas.

### Identity

Identity answers **"who is looking at this timeline?"** It contains the
representative Uma, club affiliation, play style, and optional Trainer ID. It is
closer to a Trainer Card or Stable Card than account settings.

The representative Uma is distinct from Tazuna. The representative says "this is
me"; Tazuna says "what does this mean?"

Play Style is the friendly front door to forecast assumptions. It can seed the
stored configuration without making first-run users understand every income
stream up front.

### Resources

Resources answers **"what can I spend?"** It owns the dated resource snapshot the
engine projects forward from (the [anchor bar](ui-timeline.md#the-line-is-an-instrument)).
Re-anchoring = updating that snapshot to today, exactly what the staleness
grey-trend gently nudges toward (principle 6).

The top level is the pull economy: carats plus trainee/support tickets. Recovery
assets such as crystals and shards are secondary and collapsed by default because
they answer "what happens if the banner goes badly?", not "can I pull?"

Resources should visually separate **entered snapshot inputs** from **projected
readouts**. First-run testing showed users expected balance fields to recompute
when scrubbing the timeline; the UI needs to make the dated snapshot feel like an
anchor the player controls, not a live output from the current cursor date.

**First run — the empty balance is a CTA.** A brand-new player has never set a
balance, so there is no anchor and nothing to project. That empty state turns the
balance readout into a gentle setup invitation. It is the one empty state that
invites rather than recedes because the snapshot is the load-bearing input the
whole projection hangs on.

### Advanced Configuration

Forecast details still exist, but they are advanced overrides rather than the
front door. These are **configuration**, not settings: they describe the user's
account/forecast model and feed projection. Settings are presentation or behavior
preferences such as theme or animation, and do not describe the stable.

- Team Trial / Club rank and Champion's Meeting target assumptions.
- Daily Pack and remaining days.
- Weekly Login cadence.
- Monthly ticket assumptions.
- Paid-currency inclusion.
- Participation scales, where "do not participate" is the zero end rather than a
  separate stream toggle.

These are **stored config inputs** ([persistence.md](persistence.md)); saving
Resources or advanced configuration commits the relevant input changes and fires
**one** recompute (principle 7), after which every view re-derives. Save must give
visible feedback, and Tazuna should explain the first successful save.

> Leans resolved — principle 3's open question. Income config is **parametric and
> global** (presets/ranks, a login cadence), *not* a set of per-event below-lane
> toggles ("did I run *this* CM?"). The below lane stays **passive sources**;
> per-instance reconciliation rides the
> [rushable toggle](ui-timeline.md#rushable-events-the-opt-in-inversion) ("I already
> finished that story"), not a separate did-I-run-it input.

> Forward-pointer: the Henry Handsome calculator also carries **League of Heroes**
> and **Training Pass** rows. Horsetrader's config will likely grow to match — but
> **League of Heroes is ETL-unmodelled today** (a quarterly PvP that replaces a CM),
> so it's a cross-side dependency, not a frontend-only add.

---

## The dev / debug panel ("Developer Tools")

A **grab-bag of developer/debug utilities**, deliberately held to a *lower bar*
than the product surfaces — where ephemeral switches live, not a designed
experience. Reached via the **hammer icon** (the Resources / Advanced Configuration
door); there's an in-game hammer/tool asset to source for it (principle 5), not
the placeholder. Like everything else it's a non-blocking overlay (principle 1).
What's in the bag today:

- **Daily P&L dots** — toggles the devdots (see
  [ui-timeline.md](ui-timeline.md#the-line-is-an-instrument)), the
  per-transaction-day dots on the line. This is the home of that
  graduation-undecided debug surface; the toggle is **ephemeral** (a view switch,
  not persisted state). *(Stream toggles — the coordinator's `setEnabled` channels
  — belong here too.)*
- **Force date** — override "today" to an arbitrary date, to test the projection /
  prediction at any point. **Interlock: while a forced date is set, Resources saving
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
  nagged (principle 6). Reset wipes — the destructive inverse of snapshot entry.
  (Export likely shares a serialise primitive with the [plan's](#the-plan)
  shareable link, but its *purpose* is diagnosis, not sharing.)
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
the same machinery the state export and the plan's shareable link reuse.

> Resolved: the focus-taking exception is **retired**. Nothing takes over the user's
> ability to scroll the timeline — what's-new **floats in front until dismissed**
> like every other overlay; it may be front-and-centre (and dim the canvas) but it
> never locks the scroll. The no-modal rule is now **absolute** (the only tolerated
> breach anywhere is the dev panel's native `alert()`s, and those are dev-only).

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
  same serialise machinery as the dev export and the what's-new last-seen-version.
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
> vs source-breakdown + copy-stats + confirmation). The clean way to hold it:
> **favourites are the *who & what*** (which atoms I want); **the plan is the *when &
> how*** (when they land, how I fund and commit to them) — the plan is the
> **banner-corollary of a favourite**.

> Open: the input-granularity *label* (pities vs pulls) from principle 10 in
> [ui.md](ui.md) — a row displays both a pull figure and a pity figure; which unit
> the player *commits in* (at source) is still the open presentation call.

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
  scenarios — grant nothing and still get a card; a reward-less card just has zero
  height. Visibility is opt-out — an explicit `visible: false` in the engine hides
  it.)

What's clipped below the fold is **not load-bearing**, because **banner value is
derived** (see [The banner card](#the-banner-card-above-lane-contents)): "delivers
N of my favourites" is a computed rollup, so the banner can be assessed *without*
scrolling through it. Ordering of the pills (e.g. float favourited atoms to the
top) is left **open**.

> Polish, not structure: the scrolled region wants a clearer *affordance* ("there's
> more below the fold"). Intent holds; the signal is an implementation detail.

---

## See also

- [ui.md](ui.md) — the ten principles these surfaces hang off.
- [ui-timeline.md](ui-timeline.md) — the timeline substrate and lane mechanics.
- [menu.md](menu.md) — the menubar, Identity, Resources, and Tazuna in detail.
- [engine.md](engine.md) — the coordinator API.
- [persistence.md](persistence.md) — the inputs the input surfaces collect.
