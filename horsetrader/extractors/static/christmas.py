import functools
import re
from datetime import timedelta, tzinfo

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger

from . import store
from ._durations import parse_duration

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^holiday-christmas-\d{4}$")


def _period(
    block: dict,
    tz: tzinfo,
    where: str,
    fallback_span: timedelta | None,
) -> Period:
    start = store.require_zone(block.get("start"), tz, f"{where}.start")
    raw = block.get("duration")
    span = parse_duration(raw, f"{where}.duration") if raw is not None else fallback_span
    return Period(start=start, span=span)


@functools.cache
def load() -> list[dict]:
    """Curated reward-bearing Christmas campaigns, with optional EN overlays."""
    source = store.source()
    records: list[dict] = []
    for key in store.select(_KEY_PATTERN):
        where = f"{source}: Christmas holiday {key!r}"
        top = store.shared(key)

        name = str(top.get("name", "")).strip() or None
        if name is None:
            raise ValueError(f"{where} is missing a string 'name'")

        jp_block = store.overlay(key, "jp")
        if jp_block is None:
            raise ValueError(f"{where} is missing required 'jp' block")
        jp_period = _period(jp_block, JST, f"{where} jp", None)

        en: dict | None = None
        en_block = store.overlay(key, "en")
        if en_block is not None:
            en_period = _period(en_block, UTC, f"{where} en", jp_period.span)
            en = {"period": en_period, "source": source}

        rewards = top.get("rewards")
        if rewards is not None and not isinstance(rewards, dict):
            raise ValueError(f"{where}: rewards must be a mapping")
        banner = top.get("banner")

        records.append({
            "key": str(key),
            "name": name,
            "period": jp_period,
            "source": source,
            "banner_url": str(banner).strip() if banner else None,
            "rewards": rewards,
            "visible": store.optional_bool(top, "visible", where),
            "en": en,
        })
    logger.info("Loaded %d Christmas holiday launches", len(records))
    return records
