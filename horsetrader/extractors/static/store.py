"""The static-data store — a single merged keystore.

**Every** ``*.yaml`` in ``static/yaml/`` is auto-loaded and merged into one
in-memory corpus keyed by stable key — no whitelist, no per-file marking; drop
a new file in and it's picked up. Out-of-scope files live elsewhere
(``static/pending/``, ``references/import/``), not in this directory.

**Filenames are organisational, never semantic.** A stable key resolves the
same wherever it's authored; loaders ask for *their* entries by **key pattern**
(``select(pattern)``), not by file, so an entry can be moved between files
freely. The entry shape is a ``dict[stable-key, entry]`` where each entry holds
optional region-agnostic fields plus per-locale (``jp:`` / ``en:``)
sub-mappings; stable-key shapes are globally unique (``anchor-new-year-*``,
``anchor-golden-week-*``, ``anchor-anni-*``, ``scenario-NN``, ``story-NNN``,
``<id>-banner``, and the anchored-event ``before-`` / ``during-`` / ``after-``
prefixes), so each loader's pattern claims a disjoint slice and a key appearing
in two files fails loud at merge time.

The API entity loaders see:

- ``select(pattern)`` — the keys matching a stable-key shape, corpus-wide.
- ``overlay(key, locale)`` / ``shared(key)`` — an entry's per-locale block /
  region-agnostic fields.
- ``find(key)`` — the raw entry for any key (cross-corpus lookup).
- ``source()`` — generic provenance (the corpus directory), so loaders and
  models never name a file.

``load(filename)`` is the low-level single-file parser that backs the merge.

Work-from-the-back: primitives here handle I/O, the merge, and zone validation;
each entity loader stays responsible for its own field schema and output shape.
"""

import functools
import re
from datetime import datetime, tzinfo
from typing import NamedTuple

import yaml

from horsetrader.core import Config
from horsetrader.info import Logger

logger = Logger.get(__name__)

# The locale namespaces an entry's per-region blocks live under. Everything
# else at entry top-level is region-agnostic (`shared`), including nested
# mappings like a `rewards:` block.
LOCALES = ("jp", "en")


class Entry(NamedTuple):
    """One corpus entry: the file that authored it and its parsed mapping.

    ``filename`` is retained only for the duplicate-key diagnostic — it's never
    a selection key (loaders match on the stable key, not the file).
    """

    filename: str
    data: dict


@functools.cache
def load(filename: str) -> dict:
    """Return the parsed mapping for ``config/yaml/<filename>``, or ``{}`` if absent.

    Low-level single-file parser that backs the corpus merge.
    """
    path = Config().curated_yaml / filename
    if not path.exists():
        return {}
    with path.open() as f:
        raw = yaml.safe_load(f) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{path} is empty or not a mapping")
    logger.info("Loaded %s (%d entries)", filename, len(raw))
    return raw


def _corpus_files() -> list[str]:
    """Every yaml in ``config/yaml/``, sorted — the whole directory *is* the
    corpus, no whitelist and no per-file marking. Out-of-scope files live
    elsewhere (``config/pending/``, ``references/import/``), never here.
    """
    return sorted(p.name for p in Config().curated_yaml.glob("*.yaml"))


@functools.cache
def _corpus() -> dict[str, Entry]:
    """Merge every yaml in ``config/yaml/`` into one ``stable-key -> Entry`` map.

    Insertion follows filename order, then each file's key order. A stable key
    defined in two files fails loud — keys are globally unique by design.
    """
    merged: dict[str, Entry] = {}
    files = _corpus_files()
    for filename in files:
        for key, data in load(filename).items():
            k = str(key)
            if k in merged:
                raise ValueError(
                    f"duplicate stable key {k!r} in {filename} "
                    f"(already defined in {merged[k].filename})"
                )
            if not isinstance(data, dict):
                raise ValueError(
                    f"{filename}: entry {k!r} must be a mapping; got {data!r}"
                )
            merged[k] = Entry(filename, data)
    logger.info(
        "Merged static corpus: %d entries from %d files", len(merged), len(files)
    )
    return merged


def select(pattern: "str | re.Pattern[str]") -> list[str]:
    """Corpus keys matching ``pattern`` (``re.match`` semantics), in corpus order.

    The keystore's one query: a loader asks for its own entries by their
    stable-key shape, never by which file they live in.
    """
    rx = re.compile(pattern) if isinstance(pattern, str) else pattern
    return [k for k in _corpus() if rx.match(k)]


def find(key: str) -> dict | None:
    """The raw entry mapping for ``key`` anywhere in the merged corpus, or None.

    The cross-corpus escape hatch: resolve any stable key without knowing which
    file authored it.
    """
    entry = _corpus().get(key)
    return entry.data if entry is not None else None


def source() -> str:
    """Generic provenance for every curated static entry — the corpus directory,
    not a per-file path. Entries can live in any file, so the provenance *is*
    the keystore as a whole; nothing downstream names a file.
    """
    return str(Config().curated_yaml)


def overlay(key: str, locale: str) -> dict | None:
    """Per-(key, locale) block, or None if the entry or locale block is absent."""
    entry = _corpus().get(key)
    if entry is None:
        return None
    block = entry.data.get(locale)
    return block if isinstance(block, dict) else None


def shared(key: str) -> dict:
    """Region-agnostic fields on ``key`` — every top-level field except the
    per-locale (``jp:`` / ``en:``) blocks. Nested non-locale mappings (e.g. a
    ``rewards:`` block) are returned intact."""
    entry = _corpus().get(key)
    if entry is None:
        return {}
    return {k: v for k, v in entry.data.items() if k not in LOCALES}


def require_zone(value, expected: tzinfo, label: str) -> datetime:
    """Validate ``value`` is a tz-aware datetime in ``expected``, or raise."""
    if not isinstance(value, datetime) or value.tzinfo != expected:
        raise ValueError(
            f"{label} must be an ISO timestamp in {expected!r}; got {value!r}"
        )
    return value
