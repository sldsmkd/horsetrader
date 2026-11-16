# Twinkle Monthly

> *"Thank you for agreeing to today's interview. I've been looking forward to speaking with you."*
> — Etsuko Otonashi, reporter, *Twinkle Monthly*

Status: **phases 1–2 shipped; phase 3 (the Desk) in discovery; To Press parked.**

Codename for the work that turns favourites + the plan from a feature
reimplementation into the planner's own voice. Otonashi is the magazine reporter
who *interviews* the trainer and writes up the why behind every line — so the
thesis is: **the trainer's intent is the story, and the tool should let them write
it down.** It was the first feature that is not a capability-by-capability
reimplementation of prior art.

The name is a metaphor, **not a visual skin** — nothing is styled as a magazine; it
all stays in the glass-table language.

Durable design lives in the frontend docs:
[persistence.md](../../frontend/persistence.md) (the notes section),
[ui-surfaces.md](../../frontend/ui-surfaces.md) (card detail, film strip, the
Desk). This folder is the project record; the Desk's open IA work is in
[desk.md](desk.md).

---

## The thesis

A plan is not a list of numbers. It is a set of *intentions*, some of which happen
to be expressible as a pity number.

1. **Intent is the point, and the old tools punish writing it down.** "Stop at 200
   if I can, 400 if I can afford it", "#1 oshi, none negotiable", "OG insurance /
   see the rerun first" — that scrawl *is* the plan; the number is its shadow.
2. **A note floats free of want and intent.** Proof: a row marked **"I DON'T
   WANNA"** — a *character* note about Sweep Tosho (who refuses to leave the gate
   until she feels like it), on a favourite the trainer had *also* pulled 200 on.
   The note coexists with a maxed favourite and a spent commitment, says something
   neither can hold, and must survive the subject going historical with no upkeep.
3. **Favourites and the plan are two questions.** *What do I still need?*
   (favourites, atom-keyed, retired on acquisition) vs *what am I doing about it?*
   (the plan, banner-keyed, pity + spend). They used to share one drawer flipped
   by a tab.

## The model — three orthogonal intent layers

| Layer | Keyed by | Question | Captures |
|---|---|---|---|
| **Favourites** | atom id | *what do I want?* | "I still need this" — retired on acquisition |
| **Commitments** | banner id | *what am I doing about it?* | "pull to pity N" (+ paid-carat opt-in) |
| **Notes** | subject id (atom **or** banner) | *why?* | free text — rationale, flavour, conditions |

None implies another; each is sparse. A note is the most durable layer: the
favourite retires and the commitment spends, but the reason stays attached.

## Phasing (Otonashi's by-line: corner → special → cover)

### Step 1 — the card surface (vessel first) ✅ 2026-06-21

Build the home before its contents: a spawnable trainee/support **card detail
surface** — art at size, identity facets, an outbound "full stats ↗" link —
hooked first from the commit dossier's featured atoms.

As built, with deliberate deviations from the brief:

- **The scraper reports the canonical URL; the model doesn't sniff
  `References`.** Picking "the deepest Gametora URL" kept grabbing image URLs, so
  `@transcend` constructs the canonical English entity page from the slug and
  reports it as a named `source` field, threaded scraper → index → model → record.
- **View-model split.** The kind branch lives in pure `ui/select/cardDetail.ts`
  (testable under node); `cardSurface.ts` only renders.
- **ETL enrichment pulled forward:** trainee base aptitudes (rendered as a coloured
  ladder) and character bio vitals.
- **First-class modal** (folded into `modalOpen()`), not a stacked child. Known
  rough edge, accepted: opening it from the dossier re-renders the dossier and
  resets an unsaved pity draft.

Never a stat browser: effect/hint tables stay at their source, behind the link.

### Phase 1 — The Interview (the notes layer) ✅ 2026-06-21

- **Schema:** `Notes = { [subjectId]: string }` on the synced `PlanDocument` —
  flat, because stable ids are already globally unique and prefix-typed.
  `CURRENT_VERSION 2 → 3`; the never-surfaced `FavouriteEntry.note` was folded
  into the map and dropped (a note no longer implies a star).
- **Validation:** one `normaliseNote` (trim, length cap by code point, strip C0
  controls except newline) in `core/persistence/validate.ts`, used at both the
  live write seam (`coordinator.setNote`) and persistence ingress. Rendering is
  escaped by construction (`h` appends text nodes).
- **UI:** a note box on the card surface. Notes count as syncable content.
- **Cap is a unit, not a ration.** Storage is nowhere near threatened; the cap is
  a publishable-unit choice (notes may later be shareable via *Canter*, the
  in-world social network). It started at tweet length (~280), went to a 240
  "cleat", and settled at **140 code points** (`NOTE_MAX_LENGTH`) once the Desk
  showed long notes wall a scannable row — real margin notes were all well under.

### Phase 2 — The Filing ✅

The shared Favourites/Plan drawer was broken apart. Favourites became the **film
strip** — the ordinal twin of the minimap, every favourite and commitment as
equidistant frames past a read-head. The plan became its own surface (phase 3).

### Phase 3 — The Cover 🔶 in discovery

The readable plan, split in two on purpose:

1. **The Desk** — the production surface: every committed banner as a legible row
   with its note. Built as a shell; row shape is open IA work → [desk.md](desk.md).
2. **To Press** — the publication step that freezes the Desk into a shareable
   artifact (image / encoded link / Canter). **Parked**; a clean Desk should make
   it fall out cheaply.

## Parked / not pursued

- A generalised input-validation "clearing house" — scoped down to the one
  inline normaliser; `trainerName` and other inputs are separate later passes.
- Banner notes on the timeline banner card — they live on the Desk row.
- A conviction/priority colour axis (seen in the prior-art spreadsheet) — would
  collide with the kind border and the affordability band.
