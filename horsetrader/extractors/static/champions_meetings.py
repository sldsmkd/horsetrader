import functools
import re

from horsetrader.core import UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^cm-\d{3}$")


@functools.cache
def load() -> dict[str, Period]:
    """EN confirmed Champions Meeting periods, keyed by ``cm-NNN``.

    Each entry's ``en`` block carries FQ ISO ``start`` / ``end`` (UTC), taken
    straight from the data. A CM absent here has no confirmed EN window — the
    model leaves it predicted; a CM that *is* present but malformed fails loud
    (curated data). Selected by the ``cm-NNN`` key shape, corpus-wide.
    """
    source = store.source()
    out: dict[str, Period] = {}
    for key in store.select(_KEY_PATTERN):
        en_block = store.overlay(key, "en")
        if en_block is None:
            raise ValueError(f"{source}: champions meeting {key!r} is missing required 'en' block")
        start = store.require_zone(
            en_block.get("start"), UTC, f"{source}: champions meeting {key!r} en.start"
        )
        end = store.require_zone(
            en_block.get("end"), UTC, f"{source}: champions meeting {key!r} en.end"
        )
        out[str(key)] = Period(start=start, span=end - start)
    logger.info("Loaded %d EN champions meeting periods", len(out))
    return out
