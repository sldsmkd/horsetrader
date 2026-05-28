import functools
from datetime import datetime, timezone

import yaml

from horsetrader.core import Config, JST, Period
from horsetrader.info import Logger

logger = Logger.get(__name__)

# New Year drops at 05:00 JST — early release so players can log in before
# temple visits and family meals; a documented JP-server exception to the
# standard 12:00 JST content drop rule.
_NEW_YEAR_HOUR = 5
_GOLDEN_WEEK_HOUR = 12
_EN_HOUR_UTC = 22  # EN content drop: 22:00 UTC for all holiday types


def _drop_hour(key: str) -> int:
    if key.startswith("new-year-"):
        return _NEW_YEAR_HOUR
    return _GOLDEN_WEEK_HOUR


@functools.cache
def load() -> list[dict]:
    jp_path = Config().static / "jp.holidays.yaml"
    en_path = Config().static / "en.holidays.yaml"

    with jp_path.open() as f:
        jp_raw = yaml.safe_load(f)
    if not isinstance(jp_raw, dict):
        raise ValueError(f"{jp_path} is empty or not a mapping")

    en_raw: dict = {}
    if en_path.exists():
        with en_path.open() as f:
            en_raw = yaml.safe_load(f) or {}
        if not isinstance(en_raw, dict):
            raise ValueError(f"{en_path} is empty or not a mapping")

    jp_source = str(jp_path)
    en_source = str(en_path)
    records: list[dict] = []
    for key, entry in jp_raw.items():
        try:
            d = datetime.strptime(str(entry["start"]), "%Y-%m-%d")
        except (KeyError, ValueError) as exc:
            logger.warning("Skipping holiday %s: bad date — %s", key, exc)
            continue

        en: dict | None = None
        if (en_entry := en_raw.get(key)) is not None:
            try:
                en_d = datetime.strptime(str(en_entry["start"]), "%Y-%m-%d")
            except (KeyError, ValueError) as exc:
                logger.warning("Skipping EN holiday %s: bad date — %s", key, exc)
            else:
                en = {
                    "name": str(en_entry.get("name", "")).strip() or None,
                    "period": Period(
                        start=datetime(en_d.year, en_d.month, en_d.day, _EN_HOUR_UTC, tzinfo=timezone.utc)
                    ),
                    "source": en_source,
                }

        records.append({
            "key": str(key),
            "name": str(entry.get("name", "")).strip() or None,
            "period": Period(
                start=datetime(d.year, d.month, d.day, _drop_hour(str(key)), tzinfo=JST)
            ),
            "source": jp_source,
            "en": en,
        })
    logger.info("Loaded %d holidays from %s", len(records), jp_path.name)
    return records
