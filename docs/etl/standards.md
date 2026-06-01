# Standards

Code conventions the ETL relies on. Most of these aren't enforced by a
linter — they're house rules that keep the codebase predictable. Match the
existing style; if something here is wrong or stale, fix it rather than
working around it.

## Imports

Three groups, separated by a blank line, alphabetical within each group:

1. **External** (`stdlib + third-party`)
2. **`horsetrader.*`** (absolute first-party)
3. **`.local`** (relative inside the current package)

```python
from datetime import datetime
from typing import Iterable

from horsetrader.core import Period
from horsetrader.info import Logger
from horsetrader.semantics import digitan

from .character import Character
from .entity import Entity
```

Prefer `from X import Y` over `import X` so call sites are short. When two
names collide, alias according to what they are:

- **Functions** → `re_sub` (underscore between module and name).
- **Classes** → `loggingLogger` (no underscore, lowerCamel for the source).

This makes the kind of thing visible at the call site without re-reading
the import block.

## Multi-line formatting

When a signature, list, or `__all__` is long enough that Black would
multi-line it, **force the multi-line form with a trailing comma** so the
shape is stable. Add a blank line between a multi-line signature and the
body — naked function bodies after a multi-line signature read as
continuation noise without the gap.

```python
def predict(
    self,
    timeline: Timeline,
    *,
    rules: Iterable[Rule] = (),
) -> Timeline:

    if not rules:
        return self._fallback(timeline)
    ...
```

Naturally short signatures stay single-line. Don't manually wrap things
that fit.

## Control flow

Don't write `if x == True: continue` (or `if x: continue`) where the
loop body below is the *real* work for the negative case. **Invert the
condition and put the work inside the branch:**

```python
# no
for event in timeline:
    if event.predicted == True:
        continue
    do_real_thing(event)

# yes
for event in timeline:
    if not event.predicted:
        do_real_thing(event)
```

Also: never compare to `True` / `False` explicitly — `if x:` and
`if not x:` already say what you mean.

## Explicit contracts

Base classes that define hooks use `@abstractmethod` **with a callable
body** that captures the default behaviour:

```python
@abstractmethod
def search(self, query) -> list[TEntity]:
    """The str path is the base contract; subclasses extend by dispatch."""
    if isinstance(query, str):
        ...
    raise TypeError(...)
```

Every concrete subclass **declares the override explicitly**, even if it
just defers to the parent:

```python
def search(self, query):
    return super().search(query)
```

The redundancy is the point — it forces the author to acknowledge the
contract for each concrete type, and search-by-grep finds every override.
Don't skip the trivial ones.

## Fail loud

Junk data is worse than no data. Default behaviours:

- **Library code:** `raise` on invariant violation. No `try/except: pass`,
  no silently substituted defaults, no `or` fallbacks that mask "this
  source didn't return what we expected." If a record is unusable, surface
  it.
- **Pipeline-fatal:** use `Logger.get(__name__).fatal(...)` followed by
  `SystemExit` (or let the exception propagate to `main.py`). Don't swallow.
- **Per-entity recoverable:** `Logger.warning(...)` and continue, but
  **only** when continuing is genuinely useful (e.g. one entity in a batch
  fails enrichment; the rest are still fine). The
  `TracenModels._on_enrich_error` hook is the canonical example — override
  on subclasses that want to escalate.

If you're tempted to write `try/except Exception:` with a quiet recovery,
stop and decide whether the failure is actually recoverable. If it isn't,
let it propagate.

## Config and environment

All `HORSETRADER_*` env vars are read through [`horsetrader.core.Config`](../../horsetrader/core/config.py).
**Do not call `os.environ.get` from library code.** New vars get a property
on `Config` so call sites don't sprout `environ.get` lookups, and so the
"what env vars exist" question has one answer.

`Config` is a singleton via `SingletonMeta`. `HORSETRADER_TARGET` is
lazily validated on first `.cache` / `.site` access — that keeps
import-time consumers (e.g. `Logger`) from forcing every entry point to
set the target dir. `HORSETRADER_SKIP_CACHE_REFRESH` is re-read on every
property access, so flipping it mid-run takes effect.

## Eager loading is intentional

`TracenModels.__init__` calls `_fetch()` on construction. Every collection
loads its primary source, runs its ordered enrichers, validates, and
indexes by key — **all in the constructor**. This is on purpose:

- The scraper context (robots.txt, Selenium session, rate-limit state)
  lives in `UmaClient` and stays warm across the load.
- Lazy fetching would force these contexts to be torn down and rebuilt
  per call.
- The first-run N+1 fetch loop is the price of preserving that context;
  `jitter.py` solves the followup "everything expires at once" problem.

Don't add lazy-fetching shims to "optimise" startup. If startup is slow,
[`jitter.py`](../../jitter.py) and `HORSETRADER_SKIP_CACHE_REFRESH` are the
intended tools.

## Entity / Entities are no-code wrappers

`Entity` / `Entities` in [`models/entities/`](../../horsetrader/models/entities/)
are semantic wrappers around `TracenModel` / `TracenModels` in
[`models/core/`](../../horsetrader/models/core/). **All logic lives in the
core classes.** The entity wrappers exist only so subclasses can sit under
the conventional `models/entities/` namespace and carry the `@digitan`
marker.

The same pattern (no-code wrapper + core logic class) recurs elsewhere
when a semantic decorator needs a per-domain wrapper. Don't add methods
to the wrapper class; if you find yourself wanting to, the method belongs
on the core class.

## Enricher pattern

`TracenModels` builds the initial set of entities via `_fetch_primary`,
then runs an ordered tuple of `_enrichers()` over each entity:

```python
def _enrichers(self):
    return (self._enrich_from_umapyoi, self._enrich_from_wikiwiki)

def _enrich_from_umapyoi(self, character):
    record = self._client.try_get(...)
    if record is None:
        return
    character.name = record.get("name", character.name)
    character.three_sizes = record.get("three_sizes", character.three_sizes)
    ...
```

Each enricher mutates fields in place via **ternaries** that prefer the
candidate but fall back to the existing value. Enrichers don't raise on
missing data — they return silently and let the entity keep what it had.
The hook `_on_enrich_error` covers actual exceptions.

`key` is the only immutable field by convention.

This replaces older `_enrich_one` / `_merge_one` patterns. Don't
reintroduce them.

## Image URL lifecycle

`Image` is the only thing that interprets image URLs, and **it never
mutates its own url.** `CurrenChan` (image processing) finalises a
site-relative path (`/img/…`) after publishing the asset; the original
upstream URL is preserved in `image.references`. Anywhere else that
needs an image URL, go through `Image` rather than building a path
yourself.

## Comments and docstrings

Default to no comments on individual lines. Reach for one only when
*why* is non-obvious — a hidden constraint, a workaround, a behaviour
that would surprise the next reader. Don't narrate *what* the code does;
identifiers should already say that. Don't reference task numbers, PR
flows, or callers ("added for X", "used by Y") — those rot.

Class- and module-level docstrings are different: they document the
contract, not the implementation. Cover what the type promises, the
invariants callers can rely on, and the boundaries with other roles
(see existing `TracenModels`, `Pipeline`, `Predict` docstrings for the
shape). Per-character role text lives in the decorator docstring, not
duplicated on the decorated class.
