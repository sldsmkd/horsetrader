import functools
import re

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^anchor-anni-\d+_\d+$")


@functools.cache
def load() -> list[dict]:
    """Anniversary anchors from the merged store (JP + EN).

    Each record has ``key``, ``period`` (JP launch, 12:00 JST), ``source``,
    and an ``en`` key (``dict | None``) carrying the EN ``period`` (22:00 UTC)
    and ``source`` — present only once an anniversary has reached Global.
    Selected by the ``anchor-anni-N_M`` key shape, corpus-wide.
    """
    source = store.source()
    records: list[dict] = []
    for key in store.select(_KEY_PATTERN):
        jp_block = store.overlay(key, "jp")
        if jp_block is None:
            raise ValueError(f"{source}: anniversary {key!r} is missing required 'jp' block")
        jp_start = store.require_zone(
            jp_block.get("start"), JST, f"{source}: anniversary {key!r} jp.start"
        )

        en: dict | None = None
        en_block = store.overlay(key, "en")
        if en_block is not None:
            en_start = store.require_zone(
                en_block.get("start"), UTC, f"{source}: anniversary {key!r} en.start"
            )
            en = {"period": Period(start=en_start), "source": source}

        top = store.shared(key)
        records.append({
            "key": str(key),
            "period": Period(start=jp_start),
            "source": source,
            "visible": store.optional_bool(top, "visible", f"{source}: anniversary {key!r}"),
            "en": en,
        })
    logger.info("Loaded %d anniversaries", len(records))
    return records
