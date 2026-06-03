# Idea: Importance-weighted y-ordering (cluster the marquee toward the spine)

Status: **exploration** — not committed, no code. Generator + packer (4e) concern.

## Idea

The most important items should sit **closest to the timeline spine** — prime
visual real estate radiates outward from the centre line. e.g. "Gold Ship week"
(a marquee/anniversary beat) wants to live right next to the spine, not buried in
an outer stack slot.

## How it relates to existing design

Extends **principle 4** ([ui.md:126](../frontend/ui.md#L126)). Today the below-lane
y-offset is *collision-only* — it deforms purely to avoid overlap and carries no
meaning ([ui.md:131](../frontend/ui.md#L131)). This adds a **semantic to the stack
order**: when a collision forces a stack, the near-spine slot is prime, so the most
important item wins it.

This does **not** break principle 4 — the stem/x stays exact; we only decide *rank
among already-collided items*. The UI still never lies about *when*; it stops being
arbitrary about *which sits closest*.

## Design notes / open questions

1. **Intrinsic vs contextual importance** (the load-bearing fork — same one the
   sweatiness idea hit):
   - *Intrinsic*: anniversary / marquee beat, important to everyone — a property of
     the event. Can ride the **generator / bundle**.
   - *Contextual*: important to *you* because you're saving for it — account-derived
     → **projection** ([../feedback_projection_is_account_not_view]).
   - Blend both, but source them separately.

2. **Must be derived, never a per-event toggle.** ui.md already litigated this and
   said no: below-lane behaviour comes from global facts (tier, login cadence), not
   per-event below-lane inputs ([ui.md:121-124](../frontend/ui.md#L121)). Importance
   has to fall out of event-type + plan, or it reintroduces the knob that section
   killed.

3. **Generator emits weight; packer consumes it.** Keep 4e (the packer) mechanical —
   stacks by collision, breaks ties by an importance weight the generator attached.
   The generator owns "what is this / how much does it matter." Clean seam.

## Corollary: ordering as a shared mechanism (buoyancy / gravity)

This is one instance of a wider theme — **ordering**. The same primitive shows up
in two places on two different axes:

- **Predict chain** ([predict.py](../../horsetrader/timeline/predict.py)): events bubble
  through predictors "most authoritative first"; the depth at which one is claimed is a
  scalar **confidence-in-the-date** rank (confirmed=0, Anniversary=1, … Fallthrough=last,
  `unpredicted`=off-scale). No explicit field today — the rank is implicit in chain order;
  capturing it as a number is nearly free.
- **Layout buoyancy**: items sort by a scalar **visual weight** — the spine is the
  waterline, important = buoyant (floats to the line), minor = heavy (sinks outward).

**The unification is the mechanism, not the scalar.** Both are "assign a scalar, sort by
it" — but confidence-in-time and buoyancy-toward-spine are *different signals*. Abstract
the sort, keep the inputs separate; collapsing them mis-ranks the predicted-marquee and
the confident-minor cases (see fork in note 1).

State of the prototype: the buoyancy order was **hard-coded** by hand. Current
`horsetrader.site` sorts both lanes by **x (date) only**
([belowLane.ts:83](../../horsetrader.site/js/src/ui/select/belowLane.ts#L83),
[aboveLane.ts:65](../../horsetrader.site/js/src/ui/select/aboveLane.ts#L65)) — no
buoyancy axis exists in the consuming code yet; the only trace is a CSS comment
("the line has gravity", [styles.css:175](../../horsetrader.site/css/styles.css#L175)).

## What the prototype actually did (resolved from a screenshot)

The prototype ordered the below-lane stack by **date + greedy downward
collision-stacking** — the near-line slot in each date-cluster goes to the
earliest-starting card; later/colliding ones drop outward. It is *not* height-ordered
and *not* importance-ordered — it's the "placed naïvely" 4d behaviour. The earlier
"stories cluster to the line" memory was a **data-gap artifact**: stories/missions
dominate the below lane today ([../project_below_lane_data_gap]), so they just *fall*
into near-line slots by date order — no layout intent.

**The screenshot makes the problem undeniable.** Near-line real estate gets allocated
by date order, not value:

- A 150-carat *Spring G1 Celebration* mission sits **on the line** in three columns.
- **CM-23 (1,600 carats)** — a marquee PvP beat — is buried two rows down.
- The *Wherefore I Adore You* story (2,160) only *lucked* into a near-line slot.

This is exactly the misallocation buoyancy-by-importance fixes: the line should attract
the 1,600 / 2,160 cards, not the 150-carat missions.

Constraint either way: card height is **sacred** (EC1, [ui.md:978](../frontend/ui.md#L978))
— height *is* the income signal, so whatever orders the stack must not squash it.
Importance changes *which slot* a card gets, never its height.

Status: current shipped code sorts below-lane by x (date) only; the vertical packer (4e)
that would consume an importance weight is unbuilt. The date-greedy stacking above is
prototype behaviour, not present code.

## Watch-outs

- Importance-near-spine can fight **EC1** (don't starve below-lane card height) and
  the per-type accent reading. Pushing the marquee thing inward must not squash the
  income signal the card height carries.
- Applies to both lanes (each radiates from the spine), but the asymmetry holds:
  below-lane stacks in y, above-lane nudges in x — the weight feeds both differently.
