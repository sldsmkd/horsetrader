import functools
import re

from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

# Alias entries live in their own `alias-` namespace and point at the atom they
# describe via `target`.
_KEY_PATTERN = re.compile(r"^alias-")

# A target is an atom (or a character whose atoms inherit the phrases), or a
# reference entity that carries searchable shorthands (a `race-` whose JRA
# abbreviations — ホープフルS — let mission titles resolve to it); never an
# event key, and never another `alias-` entry.
_TARGET_PATTERN = re.compile(r"^(char|trainee|support|race)-")


@functools.cache
def load() -> dict[str, list[str]]:
    """Curated community search aliases, gathered from the merged static corpus
    by their ``alias-`` key prefix and folded to a ``target -> phrases`` map.

    The target is a stable key (``char-`` / ``trainee-`` / ``support-``); a
    ``char-`` target's phrases apply to every trainee + support of that
    character, a ``trainee-`` / ``support-`` target's to that one card. Targets
    are NOT resolved against real atoms here — that join (and its fail-loud
    dangling-target check) is the bake's, which is the only place that knows the
    full atom universe.

    Curated data fails loud: a missing/blank target, a target that isn't an atom
    key, an empty/non-string phrase list, or two entries claiming the same target
    all raise so the pipeline run is the editor's feedback loop.
    """
    source = store.source()
    by_target: dict[str, list[str]] = {}
    for key in store.select(_KEY_PATTERN):
        where = f"{source}: alias {key!r}"
        fields = store.find(key) or {}

        target = fields.get("target")
        if not isinstance(target, str) or not _TARGET_PATTERN.match(target):
            raise ValueError(
                f"{where}: 'target' must be a char-/trainee-/support-/race- stable "
                f"key; got {target!r}"
            )
        if target in by_target:
            raise ValueError(f"{where}: target {target!r} already aliased by another entry")

        phrases = fields.get("phrases")
        if not isinstance(phrases, list) or not phrases:
            raise ValueError(f"{where}: 'phrases' must be a non-empty list")
        if not all(isinstance(p, str) and p.strip() for p in phrases):
            raise ValueError(f"{where}: every phrase must be a non-empty string; got {phrases!r}")

        by_target[target] = phrases
    logger.info("Loaded aliases for %d targets from the merged static corpus", len(by_target))
    return by_target
