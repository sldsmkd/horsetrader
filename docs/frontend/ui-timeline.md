# UI — The timeline

The timeline substrate, the two lanes, transaction timing, and the minimap.
These are the **mechanics** of the main canvas — how it works and why. The
principles that govern it live in [ui.md](ui.md). The per-surface chrome
(banner card, bookmarks, menubar, plan) lives in [ui-surfaces.md](ui-surfaces.md).

---

## Anatomy (intent, not chrome)

Time flows left→right. Banners pinned **above** as trainee+support pairs/beats;
feed/consumption events **below**; pins/dots mark where things land; the bottom
minimap is the same axis zoomed out with the balance squiggle and favourite pips.
All views over one axis and one ledger.

## The line is an instrument

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

## One ledger → many views

The detailed cards, the per-day tooltip, the cursor balance, the minimap line and
its favourite pips are **all views over the one ledger and the one fold** — no
second engine. The minimap is the proof (see [projection.md](projection.md),
[architecture.md](architecture.md)).

## The minimap, consolidated

**The timeline does two jobs: it is *navigation*, and it *shows the player density
and pressure*.** (Principle 1 — the timeline is the primary navigation; principle 2
— spacing is information.) The **minimap is that purpose concentrated**: a
**fret-lined balance instrument** — the timeline's whole semantics in miniature,
**dots + line over the one axis and one ledger**:

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

---

## Transactions post on their last day (the line lags the dots)

A **core/engine semantic** with a load-bearing UI consequence (the engine rule
lives in [projection.md](projection.md); captured here for its visual effect and
the lesson behind it):

- **Income credits on the *last day it runs*, not the first.** A Championship
  Meeting pays out at the **end** (reward set by final placement); a story is
  grinded ambiently and its rewards land when it **finishes**. The realised moment
  *is* the last day.
- **A banner commitment is the exception — it's a *claim*, not a spend.**
  Availability is still *measured* at the banner's **end** (by then you've accrued
  the window's tickets + daily + free pulls and minimised raw carat spend), but the
  **claim *debits* at the banner's *start*** — committing earmarks resources the
  moment the banner opens. So a banner's balance reaction sits at its appearance-dot,
  not after it.
- **Exception: sequences/generators** post **multiple discrete transactions**
  rather than a single end-post.

**For income, the dot and the line sit at different x — by design.** The **dot
marks an event's *appearance*** (its start); an income event's **balance line
reacts at its *end*** (last-day posting). So **the income line *lags* the dot** —
that gap is the *correct, intended* consequence of the rule, not a defect. The
prototype's wrong turn was trying to **model complex plans** to smooth it; the
simple last-day model is right, and the lag is **accepted** — players read it as
*how the instrument works*. **Banners no longer lag**: because the claim debits at
`start`, a banner's line reacts *at* its dot — the start-debit model dissolved the
banner lag entirely (one of the simplifications it bought).

> Resolved (lean): the lag is **accepted as-is**. Making it more legible (e.g.
> visibly tying a banner's appearance-dot to its later balance-reaction) is at most
> **low-priority polish**, never a model change — and likely unnecessary.

> Lesson (a sibling to principle 7's anti-mud): the urge to model complex plans was
> the **wrong instinct**; the simpler "post at the end" was the **original,
> correct** one — and supporting it cleanly was worth a **deliberate break in
> core**. Principle-4 judgment: don't build elaborate machinery; keep the semantic
> that lets the view stay honest.

---

## Rushable events (the opt-in inversion)

The default is last-day posting; **rushing is the player's opt-in inversion of it**,
and the *semi-fix* for the lag above. Rushing is an **impulse-control decision
between the player and the game** — "I grabbed that payout early" — not a planning
lever. Some events are **rushable**, some aren't (a per-event property). The marking
is an *optional* flag: read it `ev.rushable === true`, absence means not rushable
(the [contract's optional-flag convention](../contract.md#optional-flags-presence-encoded-absence-defaulted)).
**Banners are not rushable** (stripped in the ETL) — a banner is
pulls/commitment, not a collect-the-payout moment, so the toggle lives only on
**non-banner** below-lane cards (stories, scenarios, …).

Toggling a rushable event into a **rushed** state **moves its discrete rewards** from
the `end` to the `start` — *when the player actually grabbed them*. That is the whole
mechanic, and it is exact:

- **No efficiency cost.** Rush moves *where* the discrete deltas post, never their
  amount. There is no penalty model — an earlier draft imagined one; it was cut.
- **Compound rewards don't move.** Sequences/generators keep their per-day
  attribution rushed or not — only the discrete payout shifts to `start`.
- **Rush a story** → the player going ham, grinding it out early, so the rewards
  land on the timeline when they really landed.

It is a **stored input on the atom** (a per-event toggle, persist → derive —
principle 7), and pure **principle 6**: it never blocks a choice. And it only
**semi**-fixes the lag — a rushed event's line reacts at its start-dot (lag
collapses), but it's opt-in, so you'd rarely rush *just* to fix the display; the
default last-day case keeps the parked legibility problem.

**Use case — reconcile with reality, "I've already finished that."** A story
realistically gets done ~halfway through its window, so the player marks it rushed
to post the rewards *when they actually landed them*. The toggle makes the
**planner a recorder of what happened**, not just a forecaster of the default
schedule.

---

## See also

- [ui.md](ui.md) — the ten principles this detail hangs off.
- [ui-surfaces.md](ui-surfaces.md) — banner card, bookmarks, minimap as
  navigation (bookmarks section), and the rest of the chrome.
- [projection.md](projection.md) — the ledger and fold every timeline view renders.
- [engine.md](engine.md) — the coordinator API (`settledEvents`, `balanceAt`, etc.).
- [interaction.md](interaction.md) — how the view layer is wired (two-tier change
  model, the packer).
