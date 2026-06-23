import functools
import re

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^anniversary-\d+_\d+$")


@functools.cache
def load() -> list[dict]:
    """Anniversary launches from the merged store (JP + EN ground truth).

    Each record has ``key``, ``period`` (JP launch, 12:00 JST), ``source``,
    and an ``en`` key (``dict | None``) carrying the EN ``period`` (22:00 UTC)
    and ``source`` — present only once an anniversary has reached Global.
    Selected by the ``anniversary-N_M`` key shape, corpus-wide.

    Dates only: the curated record carries no rewards. An anniversary is a
    scenario-shaped launch; its reward haul / celebration campaign is a
    separate layer, not loaded here.
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
        label = f"{source}: anniversary {key!r}"
        records.append({
            "key": str(key),
            "period": Period(start=jp_start),
            "source": source,
            "visible": store.optional_bool(top, "visible", label),
            # How many PAID selector packs the store offered of each type this
            # anniversary (the escalation: 0 at 0.5, dolphin from 1.0, +whale from
            # 2.0). The carat cost of pack level 1..N is the ladder in
            # `reward-map-anniversary-selectors`; the client expands count → packs.
            "paid_ssr_selectors": store.optional_int(top, "paid_ssr_selectors", label),
            "paid_trainee_selectors": store.optional_int(top, "paid_trainee_selectors", label),
            "en": en,
        })
    logger.info("Loaded %d anniversaries", len(records))
    return records
