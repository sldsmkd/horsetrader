# Twinkle Monthly

> *"Thank you for agreeing to today's interview. I've been looking forward to speaking with you."*
> — Etsuko Otonashi, reporter, *Twinkle Monthly*

Skunkworks codename for the work that turns favourites + the plan from a feature
reimplementation into the planner's own voice. Otonashi is the magazine reporter
who *interviews* the trainer and writes up the why behind every line — so the
codename's thesis is: **the trainer's intent is the story, and the tool should
let them write it down.**

This is the first feature that is not a capability-by-capability reimplementation
of prior art. It is ours.

---

## The thesis

A plan is not a list of numbers. It is a set of *intentions* the trainer holds,
some of which happen to be expressible as a pity number. The numbers we already
model. The intentions we throw away.

Three observations drive the whole design:

1. **Intent is the point, and the old tools punish writing it down.** The scrawl
   in the margin — "stop at 200 if I can, 400 if I can afford it", "#1 oshi, none
   negotiable", "OG insurance / optional, see the rerun first" — *is* the plan.
   The number is just its shadow. A planner that can't hold the sentence is a
   calculator wearing a planner's coat.

2. **A note floats free of want and intent — it is its own input.** Proof: a row
   marked **"I DON'T WANNA"**. That is not negative intent; it is a *character
   note* about Sweep Tosho — the horsegirl notorious for refusing to leave the
   gate until she decides she wants to. The trainer favourited her *and* pulled
   the full 200; the row reads zero only because the pull is **over** and zeroing
   it was less work than deleting a row and re-jigging every other column. So the
   note coexists with a maxed favourite and a maxed commitment and still says
   something neither can hold — and it has to survive the subject going historical
   with *no* manual upkeep (the date-anchored timeline retires the past for free;
   the note just rides along). A note is not a field bolted onto a favourite — it is a third kind of
   stored input, attachable to a trainee, a support, or a banner, independent of
   starring or committing, and it can be flavour, a condition, a declaration, or
   nothing to do with the numbers at all.

3. **Favourites and the plan are two questions, not two faces of one drawer.**
   Today they share one chrome slot flipped by a tab. They answer different
   questions — *"what do I still need?"* (favourites, atom-keyed, retired on
   acquisition) vs *"what am I actually doing about it?"* (the plan,
   banner-keyed, pity + spend). Breaking them apart is half the work; making each
   able to carry the trainer's voice is the other half.

Otonashi's in-game mechanic lends the codename and the by-line, no more: she
interviews you (the notes) and writes the plan up legibly (the plan surface).
It's a naming metaphor, **not a visual skin** — nothing here gets styled as a
magazine. The work stays in the glass-table design language throughout.

---

## What exists today (the substrate)

- **Favourites** — `Favourites = { [entityId]: FavouriteEntry }`, atom-keyed
  (trainee/support stable id). `FavouriteEntry { note?: string }` already exists
  in the persisted model but is **never surfaced in the UI**. Sparse: a bare
  favourite is `{}`.
- **The plan** — `Commitments = { [bannerId]: Commitment }`, where a commitment
  is a pity integer (+ optional `use_paid`). **No note field.**
- **Shared drawer** — `ui/views/bookmarks.ts` renders one docked panel with two
  faces (`"favourites" | "planner"`), each a derived navigation view over its map.
- **Derived, not managed** — bookmarks/planner rows are pure functions of the two
  maps (`ui/select/bookmarks.ts`, `ui/select/planner.ts`). The maps are the only
  stored intent; the lists are computed.

So: the persistence seam for atom notes is already cut (`FavouriteEntry.note`);
banner notes have no home yet; and the two surfaces are physically fused.

---

## Resolved cuts

### A. A note is an orthogonal axis. *(decided)*
Notes are their own stored layer, **independent of stars and commitments**. A
note never implies a favourite. One mental model across all three subjects: a
trainee/support/banner can be *noted but not wanted* exactly like the "I DON'T
WANNA" row. The unused `FavouriteEntry.note` is therefore the wrong home — it
couples a note to a favourite. Notes move to their own subject-keyed map.

### B. The readable plan surface is in scope (and it is *not* a magazine). *(decided)*
We design the whole arc, interview → plan surface. The end of the arc is **the
plan rendered legibly** — what a planning spreadsheet did (every committed banner
with type, window, cost/pity, pulls) but readable, with the note inline. It is
*not* styled as a magazine cover; it lives in the glass-table language like
everything else. Shareability is a property a clean readable plan already mostly
has — a later opt-in, not a costume bolted on now.

---

## The model (orthogonal intent layers)

Three independent stored inputs, each keyed by the subject it annotates. None
implies another; each is sparse (absent key ⇒ no fact).

| Layer | Keyed by | The question | What it captures | Today |
|---|---|---|---|---|
| **Favourites** | atom (trainee/support id) | *what do I want?* | "I still need this" — retired on acquisition | exists |
| **Commitments** | banner id | *what am I doing about it?* | "I'm pulling to pity N" (+ spend opt-in) | exists |
| **Notes** | subject id (atom **or** banner) | *why?* | free text alongside the want/intent — rationale, flavour, conditions; can be unrelated to the numbers | **new** |

The three answer *want → intent → reason*. Notes are the layer the other two
never had: a favourite says you want it, a commitment says you'll pull, but only
a note says *"#1 oshi, none negotiable"* or *"OG insurance, see the rerun first"*
or *"won't leave the gate till she feels like it"*. A note is the most durable
layer — it outlives acquisition: the favourite retires and the commitment spends,
but the reason (and the joke) stay attached to the subject. The numbers are
re-derived around it; the words are not.

A note's subject can be a trainee, a support, *or* a banner — so the notes map is
keyed by a tagged subject id, not folded into either existing map. `FavouriteEntry.note`
is removed (it was never surfaced) and superseded by the notes layer.

> Open spec question for the notes map: one flat `{ subjectId: string }` keyed by
> already-globally-unique stable ids, vs a tagged `{ kind, id }` key. Resolve in
> the data-model spec.

---

## The card surface (atom detail) — the note's home

Clicking a trainee/support (on a banner card, a bookmark row, a search result)
opens a **card detail surface**. It is the natural home for that atom's note: a
place big enough to show the art properly and sit a tweet beside it. This is the
write/read affordance for *atom* notes (banner notes live on the banner/plan
side — see The Filing).

**Build order — vessel first.** The very first step is the surface *shell*, not
the note. Ship it minimal — art + identity facets + the outbound link — and hook
its spawn off the **commit dossier's featured atoms** (`commitDossier.ts`; the
featured cards in the "Support Card Pickup" dossier are the click targets). That
one hook proves the surface in a real place. Everything else flows in afterward:
the note layer, and richer detail as the ETL streams get traced and enriched.
Vessel → contents — notes get born into a home that already exists, instead of
building the home and its contents in one swing.

**Art-forward, planner-flavoured — not a stat browser.** We bake only identity
facets (character/name, rarity, type, variant/title, release, art, aliases — no
effects, hints, or skills). So the surface shows:

- **the art, at size** — the reason the surface earns its space;
- **identity facets** we already have (name, rarity, type, variant/title, release);
- **plan context** — favourited? committed on which banners? next appearances
  (the same derivations bookmarks/planner already compute);
- **the note** — inline, hover-to-edit, glass-table (no pencils), tweet-capped.

What it deliberately is *not*: a reproduction of the effect/hint tables. That
would make us a **browser, not a planner** (ui.md's own line). For raw stats the
card carries an **outbound link to the live db** — a quiet "full stats ↗". This
is deliberate good citizenship, not just convenience: we ingest that source, so
sending users *back* to it for the deep detail is fair play, and it spares us ETL
we'd have to own and keep current. The art and the note are what's *ours*; the
stat table is borrowed and best left at its source.

> Deep-link is a wiring task, not a data gap. Every record already carries a
> `References` provenance list (`models/core/references.py`) holding the source
> URLs it was built from — Gametora entity URLs included. They're just not
> projected into the baked academy record. Picking the canonical source URL out
> of a mixed list (URLs + cache Paths) is the **model's** job — `References` (or
> the entity) exposes its canonical link; that's what the model is *for*. The
> bake just projects that field onto the academy record. Small thread-through,
> no projection-side cleverness.

> Spec note: this surface is spawned-from-anywhere (banner content, bookmark,
> search), so it's modal-to-canvas like other shields, and must resolve an atom
> id → record through the bundle (resolve-or-throw). Whether trainee and support
> share one surface with a kind-branch or are two is a spec call.

---

## Cross-cutting: the validation clearing house

Notes are the first place we accept **arbitrary player free-text**. The only user
string today is `config.identity.trainerName`, validated ad-hoc. Rather than
scatter trim/length/escape rules across every note box, stand up **one input
clearing house** that all free-text passes through on the way in:

- single home (core — validation is an account-fact concern, not a view one) for
  the rules: max length, trim, control-char / newline policy, and the
  render-time escaping contract (notes are user data, never markup);
- `trainerName` migrates onto it too — one path, not two;
- fail-soft and legible, in the house style (curated-input rigor without the
  hand-curated loudness).

Scope it as the *minor* it is: a small pure validator + the call sites. It rides
along with The Interview because that's the phase that creates the need.

**Length is not a storage problem — it's a *unit* choice.** The plan envelope was
sized at ~5MB and notes don't threaten it (1000 notes at tweet length ≈ 280KB,
and that's the pathological "put everything in" case; real use is rounding
error). So the cap isn't a space ration — it's a deliberate format. **A tweet
(~280 chars) is the unit.** Rationale: notes may later become *shareable* via
**Canter** (the in-world social network) — opt-in sharing of favourites,
mini-reviews, a line under a published feature (The Cover). Sizing the private
note to a publishable unit from day one means
today's note is already a well-formed shareable thing: a card, a caption, a
by-line — no "too long to share" migration later. Long enough for a real thought,
short enough to never be a wall of text on a glass card.

---

## Phasing (Otonashi's by-line)

Her article's placement tiers name the arc — corner → special → cover — read as
*how finished the work is*:

1. **The Interview** — the notes layer. Stored model (orthogonal map); the atom
   note's home is the **card detail surface** (see below) and the banner note's
   is the banner/plan side. Glass-table hover-to-edit, honouring the in-timeline
   two-opt-in pointer pattern where it sits on the canvas. A note can attach to a
   subject that is favourited, committed, *and acquired/historical* all at once —
   so notes are not future-only the way the favourites navigation view is; the
   reason rides the subject wherever it appears, past included.
2. **The Filing** — break favourites and the plan apart. The one shared drawer
   (`ui/views/bookmarks.ts`, `"favourites" | "planner"` faces) splits into two
   surfaces answering two questions: *what do I still need* vs *what am I doing
   about it*. The plan carries the heavier planning weight (spend, affordability);
   favourites stays light navigation chrome. Notes thread through both.
3. **The Cover** — the plan surface itself, done right: an at-a-glance, readable
   rendering of the whole plan — every committed banner with its type, window,
   cost/pity, pulls, *and* the note that explains it — the job a planning
   spreadsheet did, but legible. Stays in the glass-table language; **not** a
   magazine skin. A clean readable plan is already most of a shareable artifact,
   so opt-in sharing (the parked shareable-plan idea) becomes a small later
   addition rather than its own build.

---

## Method

Standard skunkworks: this folder holds design → test-assumptions → spec, then a
targeted replacement on `main`. Branch: `twinkle-monthly`. Phases land in order;
each is independently shippable to `main`.
