import functools

from horsetrader.core import Config, JST, UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)


@functools.cache
def load() -> list[dict]:
    filename = "holidays.yaml"
    source = str(Config().static / filename)
    records: list[dict] = []
    for key in store.load(filename):
        jp_block = store.overlay(filename, key, "jp")
        if jp_block is None:
            raise ValueError(f"{source}: holiday {key!r} is missing required 'jp' block")
        jp_start = store.require_zone(
            jp_block.get("start"), JST, f"{source}: holiday {key!r} jp.start"
        )

        en: dict | None = None
        en_block = store.overlay(filename, key, "en")
        if en_block is not None:
            en_start = store.require_zone(
                en_block.get("start"), UTC, f"{source}: holiday {key!r} en.start"
            )
            en = {"period": Period(start=en_start), "source": source}

        top = store.shared(filename, key)
        rewards = top.get("rewards")
        if rewards is not None and not isinstance(rewards, dict):
            raise ValueError(f"{source}: holiday {key!r} rewards must be a mapping")
        records.append({
            "key": str(key),
            "period": Period(start=jp_start),
            "source": source,
            "rewards": rewards,
            "en": en,
        })
    logger.info("Loaded %d holidays from %s", len(records), filename)
    return records
