# Debut

Status: **backstage planning**.

Debut is not the feature-completion spike. Horsetrader became feature-complete
with Eclipse: the economic engine works, the planner has its core shape, and the
site can answer the question it exists to answer.

Debut is the backstage moment after that: sorting out the makeup, pinning the
costume in place, checking the lights, and feeling the anxiety/excitement before
stepping onto the stage.

It is a readiness pass for being seen.

## Thesis

Horsetrader already works. Debut makes it feel ready to meet players.

That means visible polish, copy, first impression, performance, trust signals,
rough-edge removal, and the small external chores that make a fan-built tool
legible and shareable without pretending it is a commercial launch.

The timeline is the product. Everything else is a glass table on top of it:
trainer card, search, plan, help, menus, and any first-contact treatment are
chrome floating over the still-live time world. Debut must make that world feel
confident, not replace it with a separate "homepage" shape.

## Shape

Earlier named arcs had hard technical centers:

- **Eclipse** hardened the economy engine into a mathematically pure core.
- **Trackblazer** hardened the timeline renderer until the visualisation scaled.
- **Unity** added the final missing capability: cloud save and multi-device use.

Debut is different. It is a mixed readiness board, split between code work in
this repo and external activity around the site.

It should be allowed to contain small, practical tasks rather than one large
architecture. The coherence is not "one subsystem changes"; the coherence is
"the site is ready to walk onstage."

The working board lives in [polish.md](polish.md).

## Lanes

### Presentation polish

- tidy CSS awkwardness;
- remove placeholder-feeling surfaces;
- tighten spacing, alignment, visual rhythm, and responsive behavior;
- make the first viewport feel intentional;
- if a splash / first-contact surface exists, it must behave like glass over the
  timeline: brief, dismissible, and never the main product.

### Copy and comprehension

- fix unclear labels, empty states, and save feedback;
- make the product's purpose legible without over-tutorialising;
- give important symbols and controls a home for explanation;
- preserve the planner's player-to-player voice rather than marketing tone.

### First-run readiness

- use the first-run feedback as signal, not as the whole thesis;
- reduce moments where a player has to infer basic intent by elimination;
- make help affordances real enough to carry their planned role, if they survive
  scope;
- ensure add/remove and affordability interactions are obvious in context.
- preserve the live timeline as the first thing a player meets.

See also:

- [First-run walkthrough](../docs/frontend/feedback/2026-06-04-first-run.md)

### Performance and delivery

- improve time to first byte / first useful paint where practical;
- check bundle size, caching, image delivery, and deploy headers;
- keep the static-site / low-cost posture intact;
- measure before doing speculative performance work.

### Trust and public-facing hygiene

- make errors and loading states feel cared-for;
- verify analytics-free / privacy posture is clear where it matters;
- check credits, disclaimers, and community expectations;
- make the site easy to share without making it feel like a product launch.

### External chores

- decide what "announcement" means for a fan-built player tool;
- prepare screenshots or short clips if useful;
- write the share text in community language;
- sanity-check docs, README pointers, and any public repo surfaces.

## Non-goals

- not a new economic model;
- not a renderer rewrite;
- not another cloud architecture pass;
- not monetisation, growth, funnel work, or "go to market" in the commercial
  sense;
- not a broad tutorial project unless a specific first-contact problem proves it
  needs one.

## Working rule

If a task makes Horsetrader more ready to be seen by real players, it can belong
in Debut. If it opens a new product direction, changes the core contract, or
rebuilds a subsystem for its own sake, it probably belongs in a later named arc.
