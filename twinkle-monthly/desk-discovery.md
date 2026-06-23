# The Desk — discovery (information architecture)

> Working doc. Expected to be messy. This is the discovery phase for the Desk (the
> Cover's production surface — see [[cover.md]]), and it is almost entirely an
> **information-architecture** problem before it is a UI one: we have a pile of facts
> about a plan and the question is how to *arrange* them so the whole plan reads at a
> glance. The build will follow the IA, not the other way round. Branch:
> `twinkly-monthly-plan`.

This is likely the **most complex and most UI-rich surface on the whole site.** The
timeline is information-*dense* but spatially simple (one axis, cards on lanes). The
Desk is the opposite: a small number of rows, but each row is a lot of meaning, and
the *relationships between rows* (totals, ordering, grouping, affordability across
the whole plan) are where the value is. So we expect this doc to sprawl before it
settles. That's fine — let it.

---

## What we're arranging (the raw material)

Before any layout, the honest inventory. Per **committed banner** (the row's subject),
everything already computed and reachable — nothing here needs new projection:

**From `commitmentStatuses()` (the funding fact, cached per write):**
- `kind` — trainee / support
- `pity` — the commitment (the spend target)
- `unfundable` — affordability flag → red band
- `capacity` — pull capacity left after the commitment reserves its spend

**Derived from those (existing rules):**
- `pityBand` — grey / green / purple / red (none / sensible / waste / unfundable)
- cost, in whatever unit we pick — carats / pulls / pity-bags
  ([[project_pulls_vs_pity_units]] — a unit *choice*, part of the IA)

**From the bundle event:**
- window (`start`/`end`), past-ness (`end < now`)
- `contents` → featured atoms (the `atomChip` pills; favourite + inspect → card surface)
- `rewards.pulls` → free-pull grant, heat tier (`bannerHeatBand`)

**From the notes layer (The Interview):**
- the **banner note** — the *why*, inline, the thing the spreadsheet never held

**Whole-plan aggregates (NOT yet computed — candidate new systems):**
- total spend across the plan (sum of commitments in some unit)
- total over a horizon / per month
- affordability of the *whole* plan against the projected balance, not just per-banner
- count, by kind / by band

That last block is the part the README hinted at with "probably more systems to drive
this." Per-banner facts exist; **plan-level rollups don't yet.** Discovering which
rollups matter is core IA work here.

---

## The questions IA has to answer

Roughly in order of how much they shape everything else:

1. **What is the spine — what does a reader scan down?** Date order (the timeline's
   logic, re-flattened)? Band/affordability (problems first)? Kind? Oshi/character?
   The spine is the first decision because grouping and totals hang off it.
2. **One flat table, or grouped?** e.g. group by month, by kind, by "settled vs at
   risk". Grouping introduces section headers and sub-totals — power, but weight.
3. **What's primary vs secondary in a row?** The eye should land on one thing first.
   Candidate: the affordability signal (band) is the alarm; the note is the meaning;
   the numbers are reference. Which is the headline?
4. **Progressive disclosure.** A row can't show everything without becoming a wall.
   What's always-visible vs revealed on expand/hover? (The film strip's answer was
   *radical* compression; the Desk's is the opposite end — so it needs its own
   discipline about what earns always-on space.)
5. **The whole-plan gestalt.** What does the surface say in one second *before* you
   read any row? A total? A health colour? "You can afford this / you can't"? This is
   the bit a spreadsheet never gave and is probably the Desk's reason to exist.
6. **Editing in place.** Is the Desk read-only (the commit dossier stays the writer)
   or does pity edit on the row? If it edits, it overlaps the dossier's job — resolve
   the writer/viewer boundary. (Lean: viewer first, prove the read, add editing only
   if the round-trip to the dossier feels broken.)
7. **Units.** Carats vs pulls vs pity-bags — pick the one that makes the *plan* read,
   which may differ from the per-banner card's choice.

---

## Candidate organizing axes (to try, not decided)

- **By time** — flatten the timeline into a list. Familiar; the past tail greys out.
  Risk: the most useful rows (upcoming, at-risk) aren't grouped together.
- **By affordability band** — red first (problems), then purple (waste), then green,
  grey last. "Triage" framing. Risk: loses the calendar story.
- **By kind** — trainees vs supports. Cheap, weak — doesn't answer a real question.
- **By oshi / character** — group a horsegirl's banners together (the favourites lens).
  Emotionally true to the codename. Risk: a banner has multiple contents.

Probably the spine is **time**, with band as a *signal* not a sort, and a plan-health
gestalt on top. But that's a hypothesis to build against, not a decision.

---

## Cross-cutting boundaries (settled context, don't relitigate)

- **Writer vs viewer.** The commit dossier (`commitDossier.ts`) is the established
  *writer* of pity (live draft). The Desk starts as a *viewer* of the cached statuses.
  Any in-row editing has to reconcile with that — don't fork the write path.
- **Card surface is one click away.** Atom notes + identity live there, reached via
  `atomChip`. The Desk doesn't duplicate that — it shows the chips and lets them open.
- **The banner note is the Desk's own.** Atom notes → card surface; banner notes →
  the Desk row. That division is from The Interview and holds.
- **Agrees with the strip + badge by construction.** Same `commitmentStatuses()` +
  `pityBand`. If a row ever disagrees with the strip capsule, that's a bug, not a
  design choice.

---

## Forward: shaping the forecast (limit breakers) — not yet built

The per-row forecast is the seam a later feature plugs into: letting the player
**commit limit breakers** to *shape* the predicted outcome (raise the guaranteed
floor / pre-owned copies), feeding the same `bannerForecast` model the dossier and
the Desk already share. A "model selectors" sidequest precedes it.

**Kind asymmetry — load-bearing.** Rainbow limit breakers (`rainbow_crystal` /
`rainbow_crystal_shards`, the SSR-support LB currency in the resource model) are a
valid resource for **support** banners only — **not trainee** banners (trainees star
up off character pieces, not crystals). So the LB lever is *support-path only*: the
forecast-shaping affordance must not offer rainbow crystals on a trainee commitment.
This is why the compact forecast was deliberately left kind-agnostic with no LB
labelling — the kind branch belongs at the *shaping input*, not the readout.

## Running log (discoveries, dead ends, reversals)

*(append as we build — what the live surface taught us, what we tried and cut)*

- **2026-06-23 — first live build of the row.** Iterated against the running dev server.
  Settled shape so far, left→right: **commit cell** (the shared `commitmentBadge` wearing
  the banner's badge chrome — rounded-square box, band fill, ring, title-weight pity —
  with the **start date stacked beneath it**, `Jul 2` over `2026`, as one unit) · **content
  chips** (compact pure-icon `atomChip`: square portrait, support type pip floated to the
  top-right corner Gametora-style, no text; **sorted `favourited DESC, rarity, name` and
  capped to `MAX_CHIPS = 4`** in a fixed 4-slot column so rows align) · **banner note**
  (the "why", flexible middle column) · **compact forecast** (right edge).
  - Kind (trainee/support) moved off a text pill onto the **row's left border colour** —
    the chips already read distinct, the pill was redundant.
  - The commit badge is the **dossier edit entry point**: clicking it swaps the Desk out
    for the commit dossier in one `view.set` (the dossier stays the pity writer).
  - **Width:** the Desk runs ~double the standard modal (note column wants real room).
- **OPEN QUESTION — note length.** Placeholder is currently a full **cleat (240 graphemes)**
  but at a glance that reads **too long** for a scannable spreadsheet row. Don't decide the
  display cap from the armchair — **good candidate to discover with ~4 real users** (does a
  240-char note help or wall the row? truncate-with-expand vs hard shorter cap?). The
  *storage* cap stays a cleat; this is about how much the Desk row *shows*.
