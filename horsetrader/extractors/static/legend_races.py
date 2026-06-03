import functools
import re

from horsetrader.core import UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^legendrace-\d{3}$")


@functools.cache
def load() -> dict[str, Period]:
    """EN confirmed Legend Race windows, keyed by ``legendrace-NNN``.

    Each entry's ``en`` block carries FQ ISO ``start`` / ``end`` (UTC), taken
    straight from the data. A race absent here has no confirmed EN window — the
    model leaves it predicted; a race that *is* present but malformed fails loud
    (curated data). Selected by the ``legendrace-NNN`` key shape, corpus-wide.
    """
    source = store.source()
    out: dict[str, Period] = {}
    for key in store.select(_KEY_PATTERN):
        en_block = store.overlay(key, "en")
        if en_block is None:
            raise ValueError(f"{source}: legend race {key!r} is missing required 'en' block")
        start = store.require_zone(
            en_block.get("start"), UTC, f"{source}: legend race {key!r} en.start"
        )
        end = store.require_zone(
            en_block.get("end"), UTC, f"{source}: legend race {key!r} en.end"
        )
        out[str(key)] = Period(start=start, span=end - start)
    logger.info("Loaded %d EN legend race windows", len(out))
    return out
