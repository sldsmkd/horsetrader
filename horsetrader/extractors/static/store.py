"""Generic primitives for the consolidated `static/*.yaml` overlay store.

Each consolidated static yaml is conceptually a `dict[key, entry]` where each
entry holds optional region-agnostic fields plus per-locale (`jp:` / `en:`)
sub-mappings. The primitives here handle I/O and zone validation; each entity
loader stays responsible for its own field schema and output container shape.

Work-from-the-back: start small, lift patterns up as they repeat across the
entity loaders (holidays, stories, anniversaries, scenarios).
"""

import functools
from datetime import datetime, tzinfo

import yaml

from horsetrader.core import Config
from horsetrader.info import Logger

logger = Logger.get(__name__)


@functools.cache
def load(filename: str) -> dict:
    """Return the parsed mapping for `static/<filename>`, or `{}` if absent."""
    path = Config().static / filename
    if not path.exists():
        return {}
    with path.open() as f:
        raw = yaml.safe_load(f) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{path} is empty or not a mapping")
    logger.info("Loaded %s (%d entries)", filename, len(raw))
    return raw


def overlay(filename: str, key: str, locale: str) -> dict | None:
    """Per-(key, locale) block, or None if entry or locale block is absent."""
    entry = load(filename).get(key)
    if not isinstance(entry, dict):
        return None
    block = entry.get(locale)
    return block if isinstance(block, dict) else None


def shared(filename: str, key: str) -> dict:
    """Region-agnostic fields on this entry — top-level keys whose values are
    not locale-block mappings."""
    entry = load(filename).get(key)
    if not isinstance(entry, dict):
        return {}
    return {k: v for k, v in entry.items() if not isinstance(v, dict)}


def require_zone(value, expected: tzinfo, label: str) -> datetime:
    """Validate `value` is a tz-aware datetime in `expected`, or raise."""
    if not isinstance(value, datetime) or value.tzinfo != expected:
        raise ValueError(
            f"{label} must be an ISO timestamp in {expected!r}; got {value!r}"
        )
    return value
