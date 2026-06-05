import functools
import re

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^anchor-(new-year|golden-week)-\d{4}$")


@functools.cache
def load() -> list[dict]:
    source = store.source()
    records: list[dict] = []
    for key in store.select(_KEY_PATTERN):
        jp_block = store.overlay(key, "jp")
        if jp_block is None:
            raise ValueError(f"{source}: holiday {key!r} is missing required 'jp' block")
        jp_start = store.require_zone(
            jp_block.get("start"), JST, f"{source}: holiday {key!r} jp.start"
        )

        en: dict | None = None
        en_block = store.overlay(key, "en")
        if en_block is not None:
            en_start = store.require_zone(
                en_block.get("start"), UTC, f"{source}: holiday {key!r} en.start"
            )
            en = {"period": Period(start=en_start), "source": source}

        where = f"{source}: holiday {key!r}"
        top = store.shared(key)
        visible = store.optional_bool(top, "visible", where)
        rewards = top.get("rewards")
        if rewards is not None and not isinstance(rewards, dict):
            raise ValueError(f"{source}: holiday {key!r} rewards must be a mapping")
        records.append({
            "key": str(key),
            "period": Period(start=jp_start),
            "source": source,
            "rewards": rewards,
            "visible": visible,
            "en": en,
        })
    logger.info("Loaded %d holidays", len(records))
    return records
