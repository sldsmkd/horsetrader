import functools
from datetime import date, datetime, timezone

import yaml

from horsetrader.core import Config, Period

# Banners go live at 22:00 UTC and close at 21:59 UTC on the stated end date.
# Model end as 22:00 UTC on that date — the 1-minute gap is display rounding,
# and mirrors the JP side where both endpoints are stamped at 12:00 JST.
_BANNER_HOUR = 22


@functools.cache
def load() -> dict[str, tuple[date, date]]:
    path = Config().static / "en.banners.yaml"
    with path.open() as f:
        raw = yaml.safe_load(f)
    if not isinstance(raw, dict):
        raise ValueError(f"{path} is empty or not a mapping")
    return {
        key: (entry["start"], entry["end"])
        for key, entry in raw.items()
        if isinstance(entry, dict) and "start" in entry and "end" in entry
    }


def to_period(start_date: date, end_date: date) -> Period:
    utc_start = datetime(
        start_date.year, start_date.month, start_date.day, _BANNER_HOUR, tzinfo=timezone.utc
    )
    utc_end = datetime(
        end_date.year, end_date.month, end_date.day, _BANNER_HOUR, tzinfo=timezone.utc
    )
    return Period(utc_start, span=utc_end - utc_start)
