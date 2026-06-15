import functools
import re
from datetime import timedelta, tzinfo

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger

from . import store
from ._durations import parse_duration

logger = Logger.get(__name__)

# Golden Week launches, keyed `holiday-golden-week-<year>`. The `holiday-`
# namespace is the new scenario-shaped `Holiday` type that replaced the synthetic
# Golden Week anchors (#62); New Year will join it once its countdown is modelled.
_KEY_PATTERN = re.compile(r"^holiday-golden-week-\d{4}$")


def _period(block: dict, tz: tzinfo, where: str, fallback_span: timedelta | None) -> Period:
    """Build a region Period from `start` (+ optional `duration`) in `tz`.

    Golden Week is a real windowed event. The span comes from this region's
    `duration` (ISO-8601) when curated; absent, it falls back to `fallback_span`
    — the EN window inherits the JP run length rather than restating it — or
    span-0 if there's no fallback either.
    """
    start = store.require_zone(block.get("start"), tz, f"{where}.start")
    raw = block.get("duration")
    span = parse_duration(raw, f"{where}.duration") if raw is not None else fallback_span
    return Period(start=start, span=span)


@functools.cache
def load() -> list[dict]:
    """Curated Golden Week launches (JP + optional EN), from the merged store.

    Each record has key, name (the themed title — "Golshi Week", "Gyaru Week",
    …), period (JST window), source, an optional `banner_url`, a 'rewards' key
    (baked-shape mapping | None), and an 'en' key (dict | None) carrying the EN
    period + source when shipped. Periods are real windows (`start` + per-region
    `duration`), not the old span-0 anchor points; the EN window inherits the JP
    run length.
    """
    source = store.source()
    records: list[dict] = []
    for key in store.select(_KEY_PATTERN):
        where = f"{source}: golden week {key!r}"
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

        visible = store.optional_bool(top, "visible", where)
        rewards = top.get("rewards")
        if rewards is not None and not isinstance(rewards, dict):
            raise ValueError(f"{where}: rewards must be a mapping")
        banner = top.get("banner")
        banner_url = str(banner).strip() if banner else None

        records.append({
            "key": str(key),
            "name": name,
            "period": jp_period,
            "source": source,
            "banner_url": banner_url,
            "rewards": rewards,
            "visible": visible,
            "en": en,
        })
    logger.info("Loaded %d golden week launches", len(records))
    return records
