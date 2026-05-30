import functools
import re

from horsetrader.core import UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^\d+-banner$")


@functools.cache
def load() -> dict[str, Period]:
    """EN confirmed banner periods, keyed by ``<id>-banner``.

    Each entry's ``en`` block carries FQ ISO ``start`` / ``end`` (banners go
    live at 22:00 UTC and the close timestamp is stamped the same), so the
    `Period` is taken straight from the data. A banner absent here has no
    confirmed EN window — the model leaves it predicted; a banner that *is*
    present but malformed fails loud (curated data). Selected by the
    ``<id>-banner`` key shape, corpus-wide.
    """
    source = store.source()
    out: dict[str, Period] = {}
    for key in store.select(_KEY_PATTERN):
        en_block = store.overlay(key, "en")
        if en_block is None:
            raise ValueError(f"{source}: banner {key!r} is missing required 'en' block")
        start = store.require_zone(
            en_block.get("start"), UTC, f"{source}: banner {key!r} en.start"
        )
        end = store.require_zone(
            en_block.get("end"), UTC, f"{source}: banner {key!r} en.end"
        )
        out[str(key)] = Period(start=start, span=end - start)
    logger.info("Loaded %d EN banner periods", len(out))
    return out
