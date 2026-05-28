import functools
from datetime import datetime, timezone

import yaml

from horsetrader.core import Config, Period
from horsetrader.info import Logger

logger = Logger.get(__name__)

_SCENARIO_HOUR_UTC = 22  # content drop: 22:00 UTC


@functools.cache
def load() -> dict[str, dict]:
    path = Config().static / "en.scenarios.yaml"
    if not path.exists():
        return {}
    with path.open() as f:
        raw = yaml.safe_load(f)
    if not isinstance(raw, dict):
        raise ValueError(f"{path} is empty or not a mapping")

    records: dict[str, dict] = {}
    for key, entry in raw.items():
        try:
            d = datetime.strptime(str(entry["start"]), "%Y-%m-%d")
        except (KeyError, ValueError) as exc:
            logger.warning("Skipping EN scenario %s: bad date — %s", key, exc)
            continue
        records[str(key)] = {
            "title_en": str(entry.get("en", "")).strip(),
            "period": Period(
                start=datetime(
                    d.year, d.month, d.day, _SCENARIO_HOUR_UTC, tzinfo=timezone.utc
                )
            ),
        }
    return records
