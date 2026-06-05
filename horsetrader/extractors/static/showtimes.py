import functools
import re

from horsetrader.core import UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^showtime-\d{3}$")


@functools.cache
def load() -> dict[str, dict]:
    """EN overlay + rewards for the Fuji Kiseki Showtime series, keyed ``showtime-NNN``.

    The JP run comes from the wikiru scrape; this curated file carries the EN
    window (``en.start`` / ``en.end``, UTC), the EN display ``en.name``, and the
    region-agnostic ``rewards`` block (baked-shape mapping — the model converts
    it, same as anchored events). The closed two-event series has both EN dates
    confirmed, so neither is predicted.

    Curated data fails loud: a missing/ malformed ``en`` block (incl.
    ``en.end <= en.start``) raises so the editor sees it on the next run. The
    region-agnostic ``rewards`` is optional. Selected by the ``showtime-NNN``
    key shape, corpus-wide.
    """
    source = store.source()
    out: dict[str, dict] = {}
    for key in store.select(_KEY_PATTERN):
        en_block = store.overlay(key, "en")
        if en_block is None:
            raise ValueError(f"{source}: showtime {key!r} is missing required 'en' block")
        start = store.require_zone(
            en_block.get("start"), UTC, f"{source}: showtime {key!r} en.start"
        )
        end = store.require_zone(
            en_block.get("end"), UTC, f"{source}: showtime {key!r} en.end"
        )
        if end <= start:
            raise ValueError(
                f"{source}: showtime {key!r} en.end {end} must be after en.start {start}"
            )
        top = store.shared(key)
        out[str(key)] = {
            "period": Period(start=start, span=end - start),
            "name": en_block.get("name"),
            "rewards": top.get("rewards"),
        }
    logger.info("Loaded %d EN showtime periods", len(out))
    return out
