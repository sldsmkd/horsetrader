import functools
import re

from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

# Two disjoint slices of the curated corpus: whole-string mission titles and
# NAR/local race names. Each entry is a jp→en name pair (scenarios.yaml shape).
_MISSION_PATTERN = re.compile(r"^translate-mission-")
_RACE_PATTERN = re.compile(r"^translate-race-")


def _require_name(block: dict | None, label: str) -> str:
    name = (block or {}).get("name")
    if not isinstance(name, str) or not name.strip():
        raise ValueError(f"{label} must be a non-empty string; got {name!r}")
    return name.strip()


def _load(pattern: "re.Pattern[str]", label: str) -> dict[str, str]:
    """Fold a key-prefix slice of the corpus into a ``jp.name -> en.name`` map.

    Curated data fails loud: a missing/blank jp.name or en.name, or two entries
    with the same JP source string, all raise so the run is the editor's feedback
    loop."""
    source = store.source()
    out: dict[str, str] = {}
    for key in store.select(pattern):
        where = f"{source}: {label} {key!r}"
        jp = _require_name(store.overlay(key, "jp"), f"{where} jp.name")
        en = _require_name(store.overlay(key, "en"), f"{where} en.name")
        if jp in out:
            raise ValueError(f"{where}: duplicate JP source string {jp!r}")
        out[jp] = en
    return out


@functools.cache
def missions() -> dict[str, str]:
    """Whole-string mission-title translations (``translate-mission-*``)."""
    out = _load(_MISSION_PATTERN, "mission translation")
    logger.info("Loaded %d mission translations", len(out))
    return out


@functools.cache
def races() -> dict[str, str]:
    """NAR/local race-name translations (``translate-race-*``)."""
    out = _load(_RACE_PATTERN, "race translation")
    logger.info("Loaded %d race translations", len(out))
    return out
