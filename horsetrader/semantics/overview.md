# Module semantics

This directory holds the **design vocabulary** of the ETL pipeline. Each character has two files alongside this one:

- `<character>.py` — a no-op decorator (`@digitan`, `@shakur`, …) whose **docstring** carries the role: what kind of code belongs to that character and why. IDE hover on `@digitan` surfaces the role text in-place.
- `<character>.md` — the in-character profile of the Umamusume horsegirl (or Tazuna) whose personality defines that role.

This file is the index: what each character represents, how the roles relate, and how they coexist with conventional software namespaces.

If you're new and the character names look opaque, this is the page that decodes them.

---

## The character-naming convention

The horsetrader ETL doesn't use functional module names (`scrapers/`, `predictors/`, `serializers/`). It uses character names. Each character's in-game personality is the **litmus test** for what belongs to that role: *"would this character actually do this?"* If the answer is "not really," the code is in the wrong place — find the character whose role fits, or push back and ask.

**Why:** Functional names invite drift ("well, it's *kind of* a scraper…"). Personality-based names force a sharper question — Digitan is the otaku who knows every horsegirl by heart, so anything that doesn't require *knowing about an entity* obviously isn't hers. The constraint is the point.

**How to apply:**
- When deciding where new code goes, name the character whose role matches and explain *why* (their personality / in-game function).
- If asked to put something into a character's territory, sanity-check against their role — push back if the fit is weak rather than silently going along.
- Don't invent character assignments. If no existing character clearly owns the code, ask.

---

## Cast at a glance

| Character | Role |
| --- | --- |
| **Rudolf** | Orchestration — the conductor at the top of the call stack |
| **Transcend** | Ingest / scraping — the informant who knows what to gather and parses it (stamps both JP and confirmed-UTC Periods) |
| **Shakur** | Source transport — actual HTTP, installed-client files, cache I/O, robots.txt, headless sessions |
| **Digitan** | Domain knowledge — the *who* and *what* (characters, supports, trainees) |
| **Daitaku** | Calendar primitives — Period, Periods, date math (timezone-agnostic; doesn't reason about JST↔UTC) |
| **Yayoi** | Rewards — what an event hands out (currencies, tickets, and sequence-shaped handouts) |
| **Matikanefukukitaru** (Fuku-chan) | Prediction oracle — vibes-based heuristics that fill in Global dates for unscheduled events |
| **Eishin** | Bake — tidies and serialises the final JSON outputs |
| **Shuttle** | Japlish / translations — the JP↔EN language seam (names, aliases, romanisation, locale overrides) |
| **Rob Roy** | The librarian — read model over the news corpus (cataloguing, search, navigation of the ~2,500-article archive) |
| **Curren Chan** | Image processing — resizes source images and re-encodes to WebP |
| **Tazuna** | Early-load + grab-bag utilities (cross-cutting) |
| **Spechan** | Observability — letters home about what's happening (logs) and how much/many/long (metrics), cross-cutting |

Dataflow: **Rudolf** conducts → **Transcend** extracts (using **Shakur** for source transport/cache) and stamps both JP and any confirmed UTC Periods at extraction time → **Digitan** + **Daitaku** + **Yayoi** supply entity facts, date primitives, and event rewards → **Matikanefukukitaru** fills in predicted Global dates for what's still unscheduled → **Eishin** bakes the JSON, **Curren Chan** polishes the media. **Rob Roy** keeps the news-corpus library: a queryable read model over the archive Transcend caches, consulted for enrichment/correlation. **Tazuna** and **Spechan** sit alongside, called from anywhere.

---

## Per-character roles

Role text lives in each decorator's docstring (see `<character>.py`); the per-character bio lives in `<character>.md`.

| Decorator | Role | Bio |
| --- | --- | --- |
| [`@currenchan`](currenchan.py) | Image processing | [currenchan.md](currenchan.md) |
| [`@daitaku`](daitaku.py) | Calendar primitives — Period / Periods / date math | [daitaku.md](daitaku.md) |
| [`@digitan`](digitan.py) | The *who* and *what* — domain knowledge | [digitan.md](digitan.md) |
| [`@eishin`](eishin.py) | Final output bake | [eishin.md](eishin.md) |
| [`@matikanefukukitaru`](matikanefukukitaru.py) | Prediction oracle | [matikanefukukitaru.md](matikanefukukitaru.md) |
| [`@robroy`](robroy.py) | The librarian — news corpus read model | [robroy.md](robroy.md) |
| [`@rudolf`](rudolf.py) | Pipeline orchestration | [rudolf.md](rudolf.md) |
| [`@shakur`](shakur.py) | Source transport | [shakur.md](shakur.md) |
| [`@shuttle`](shuttle.py) | Japlish / translations — JP↔EN language seam | [shuttle.md](shuttle.md) |
| [`@spechan`](spechan.py) | Observability — logging + metrics (cross-cutting) | [spechan.md](spechan.md) |
| [`@tazuna`](tazuna.py) | Early-load + utilities (cross-cutting) | [tazuna.md](tazuna.md) |
| [`@transcend`](transcend.py) | Ingest / scraping | [transcend.md](transcend.md) |
| [`@yayoi`](yayoi.py) | Rewards — event handouts | [yayoi.md](yayoi.md) |

The `.md` bios are raw character profiles from the umamusu.wiki — they're the source material for the personality-as-litmus-test rule. If a new character is added, drop their profile here, add a `<character>.py` with the role in its docstring, and add a row above.

---

## Dual structure: character names + conventional namespaces

Character names are great for the team but opaque to anyone being onboarded ("what's a digitan?"). To bridge that, the codebase deliberately uses **two parallel module structures**:

1. **Character-named modules** — encode *intent and ownership*. (Documented above.)
2. **Conventional software namespaces** — `models/entities/`, and more as they appear (`services/`, `pipelines/`, etc., taxonomy TBD). These encode *what kind of thing the code is*: data types, services, transports. Navigable by anyone with general software literacy, no Umamusume lore required.

**Don't collapse the two.** A `Character` dataclass lives in `models/entities/characters.py` (the *type*), even though Digitan "owns" knowledge about characters (the *behaviour*). Entities go in `models/`; the character module owns lookups/use-cases over those entities.

### Marking ownership: per-character decorators

When the conventional namespace is the right home for a piece of code but a character still owns it semantically, mark it with that character's no-op decorator from `horsetrader.semantics`:

```python
from horsetrader.semantics import digitan

@digitan
@dataclass
class Character(TracenModel):
    ...
```

The decorators are runtime no-ops — they're metadata for humans (and possibly tooling later). Read top-down as *"semantic role: digitan; structure: dataclass."* Each decorator carries its role description in its docstring, so IDE hover on `@digitan` (or `help(digitan)`) is the fastest way to look up what a marker means.

---

## The model apex: `TracenObject`

Every model that crosses the wire is a **`TracenObject`** — an empty abstract marker **owned by `@eishin`**, not by a domain character. Its only content is `key: StableKey`, because Eishin's bundle is `stable-key → record` maps: *to be baked is to be stable-keyed.* Ownership flips at this apex — the leaves are owned by their **producers** (`@digitan` / `@daitaku` / `@yayoi`), the root by the **consumer** (`@eishin`), since the one universal fact about every node is "it gets serialised," which is Eishin's concern.

`TracenObject` splits **identity** from **the graph**:

- `key: StableKey` lives on `TracenObject` — universal.
- `references`, `correlations`, `match` stay on `TracenModel` (which subclasses `TracenObject`) — the cross-referencing + searchability that `Entity` (`@digitan`) and `Event` (`@daitaku`) have and config doesn't.

This makes room for config as a **sibling of `TracenModel`, not a child of it**.
`@yayoi` config objects are baked to **`config.json`** by `Bake.config` (the third
wire file, alongside `academy.json`/`events.json`) and loaded upstream of Eishin,
not invented in the output layer:

- `RewardStructure` (**#6**) — a *flat* recipe: a stable key + one `Rewards`. Bakes under `reward_structures`. (`dailies`, `daily-carats`, `weekly-login`.)
- `RewardMap` (**#4**) — a *rank-graded* recipe: `tiers` maps each rank label → its own `RewardStructure`. Bakes under `reward_maps`, keyed by rank. (`team-trials`, by class.) Neither is an *Entity* (nothing in the world *is* a recipe); which rank applies is the client's call (sweatiness / account state — #19).
- `GachaConfig` — singleton game-economy constants for pull math, in
  `models/config/gacha_config.py`. Bakes under `gacha`; banner-local rates only
  carry exceptions to these defaults. The default dials live in
  `enums/gacha.py`.
