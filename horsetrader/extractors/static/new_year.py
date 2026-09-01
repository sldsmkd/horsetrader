import functools
import re

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger

from . import store
from ._durations import parse_duration

logger = Logger.get(__name__)

# New Year launches, keyed `holiday-new-year-<year>` — the scenario-shaped
# `Holiday` type that replaced the synthetic New Year anchors and lead-ins (#62).
_KEY_PATTERN = re.compile(r"^holiday-new-year-\d{4}$")


def _login(value: object, where: str) -> list[int | None]:
    """Validate a per-day `login` sequence (FreeCarats; `Null` = a no-carat day)."""
    if not isinstance(value, list) or not value:
        raise ValueError(f"{where}: 'login' must be a non-empty per-day list")
    for x in value:
        if x is not None and not isinstance(x, int):
            raise ValueError(f"{where}: 'login' entries must be ints or Null; got {x!r}")
    return list(value)


@functools.cache
def load() -> list[dict]:
    """Curated New Year launches, from the merged store.

    Each `holiday-new-year-<year>` yields TWO records: the MAIN celebration
    (anchored at the Jan-1 05:00 JST login open) and its COUNTDOWN lead-in
    (`<key>-countdown`) — a real window that ends exactly at the main's start,
    the curated replacement for the old synthetic `before-new-year` anchor.
    Rewards ride per-day `login` sequences (the model builds the SequenceReward,
    anniversary-style). The countdown carries no `en` — its EN window is derived
    from the main's EN by the predictor (it always ends at the main start).
    """
    source = store.source()
    records: list[dict] = []
    for key in store.select(_KEY_PATTERN):
        where = f"{source}: new year {key!r}"
        top = store.shared(key)

        name = str(top.get("name", "")).strip() or None
        if name is None:
            raise ValueError(f"{where} is missing a string 'name'")

        jp_block = store.overlay(key, "jp")
        if jp_block is None:
            raise ValueError(f"{where} is missing required 'jp' block")
        jp_start = store.require_zone(jp_block.get("start"), JST, f"{where} jp.start")
        raw_span = jp_block.get("duration")
        span = parse_duration(raw_span, f"{where} jp.duration") if raw_span is not None else None

        en: dict | None = None
        en_block = store.overlay(key, "en")
        if en_block is not None:
            en_start = store.require_zone(en_block.get("start"), UTC, f"{where} en.start")
            en = {"period": Period(start=en_start, span=span), "source": source}

        records.append({
            "key": str(key),
            "name": name,
            "period": Period(start=jp_start, span=span),
            "login": _login(top.get("login"), where),
            "banner_url": str(top["banner"]).strip() if top.get("banner") else None,
            "en": en,
            "source": source,
        })

        # Countdown lead-in — window ends at the main start (span derived).
        countdown = top.get("countdown")
        if countdown is not None:
            cd_where = f"{where} countdown"
            cd_jp = countdown.get("jp") or {}
            cd_start = store.require_zone(cd_jp.get("start"), JST, f"{cd_where} jp.start")
            if cd_start >= jp_start:
                raise ValueError(
                    f"{cd_where}.start {cd_start} must precede the main start {jp_start}"
                )
            records.append({
                "key": f"{key}-countdown",
                "name": "New Year Countdown",
                "period": Period(start=cd_start, span=jp_start - cd_start),
                "login": _login(countdown.get("login"), cd_where),
                "banner_url": (
                    str(countdown["banner"]).strip()
                    if countdown.get("banner")
                    else None
                ),
                "en": None,  # derived from the main's EN by the predictor
                "source": source,
            })
    logger.info("Loaded %d new year records (main + countdown)", len(records))
    return records
