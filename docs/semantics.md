# Semantics

The ETL has two parallel module structures: **conventional namespaces**
(`models/`, `extractors/`, `timeline/`, …) for *what kind of code lives
there*, and **character-named decorators** (`@digitan`, `@shakur`, …) for
*which role owns each piece semantically*. This page covers the rules; the
canonical role catalogue lives next to the code.

## Canonical reference

The single source of truth for the character roles, their dataflow
ordering, and the litmus-test heuristics for placing new code is
[`horsetrader/semantics/overview.md`](../horsetrader/semantics/overview.md).

Don't duplicate that content here. If you're trying to figure out which
character owns a piece of work, open the overview.

Per-character bios sit alongside the decorators as
[`horsetrader/semantics/<character>.md`](../horsetrader/semantics/) — raw
profiles from the umamusu.wiki used as the source material for the
personality-as-litmus-test rule.

## The dual structure, briefly

A `Character` dataclass lives in [`models/entities/character.py`](../horsetrader/models/entities/character.py)
— that's the **type**. Digitan owns knowledge *about* characters — that's
the **role**. The two meet via a decorator on the class:

```python
from horsetrader.semantics import digitan

@digitan
@dataclass
class Character(TracenModel):
    ...
```

Read top-down as *"semantic role: digitan; structure: dataclass."* The
decorators are runtime no-ops — pure metadata for humans (and possibly
tooling later). The role text lives in each decorator's docstring, so IDE
hover on `@digitan` (or `help(digitan)`) is the fastest way to learn what
a marker means.

## Rules for adding code

1. **Pick a character first, then a directory.** "Which character would
   do this?" is the question that decides ownership. The conventional
   namespace is just where the file ends up. If the role is clear,
   placement usually is too — most `models/entities/` code is `@digitan`,
   most `extractors/` code is `@transcend`, etc.

2. **If the fit is weak, push back.** Personality-based names are a
   constraint on purpose. "It's *kind of* a scraper" is the failure mode
   functional naming invites; personality forces a sharper read. If no
   existing character clearly owns the code, ask — don't invent a new
   assignment.

3. **Don't move types just because of role.** `Period` lives in `core/`
   even though it's `@daitaku`. `Character` lives in `models/entities/`
   even though it's `@digitan`. The decorator marks ownership; it doesn't
   relocate the file.

4. **Cross-character collaboration goes at the call site.** When a
   `@digitan`-owned collection needs the wire, it calls `UmaClient`
   (`@shakur`'s public surface). Don't smuggle Shakur code into a
   Digitan-owned module to "co-locate" it.

## Ownership boundaries that matter for the ETL

These are the boundaries the code currently relies on. If a change would
cross one, it's usually a sign the work needs splitting.

- **Transcend ↔ Digitan.** Extractors return plain dicts (using only
  `core/` primitives like `Period`, `References`). Entity classes
  assemble `Character` / `Trainee` / `Support` objects, attach
  correlations / references / keys. Don't return entity objects from an
  extractor.
- **Shakur is the only module that touches the wire.** Network I/O,
  `UmaClientCache`, robots.txt parsing, sentinel/404 negative-cache
  handling all live behind `UmaClient`. Use `try_get` (tolerant) or
  `get` (strict). Don't string-match on transport errors elsewhere; if
  callers need to react, expose it on the client.
- **Daitaku is timezone-agnostic.** She owns `Period` and `Periods` as
  date primitives — they store whatever `tzinfo` you give them and
  enforce one Period per zone. Cross-zone reasoning (JST → predicted
  UTC) is `@matikanefukukitaru`'s problem.
- **Image url lifecycle is publisher-driven.** `Image` never mutates its
  own url. `CurrenChan` finalises it to a site-relative path
  (`/img/…`) after publishing; the original web URL is preserved in
  `image.references`. All url interpretation goes through `Image`.

## When `horsetrader/semantics/overview.md` and this page disagree

The overview wins. This page is a gateway; the overview is the catalogue.
If you spot drift between them, fix the overview and trim the redundancy
here.
