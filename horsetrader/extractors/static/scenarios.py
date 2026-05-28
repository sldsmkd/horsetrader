import functools
from datetime import datetime

import yaml

from horsetrader.core import Config, JST, Period
from horsetrader.info import Logger

logger = Logger.get(__name__)

_SCENARIO_HOUR = 12  # content drop: 12:00 JST


@functools.cache
def load() -> list[dict]:
    path = Config().static / "jp.scenarios.yaml"
    with path.open() as f:
        raw = yaml.safe_load(f)
    if not isinstance(raw, dict):
        raise ValueError(f"{path} is empty or not a mapping")

    source = str(path)
    records: list[dict] = []
    for key, entry in raw.items():
        try:
            d = datetime.strptime(str(entry["start"]), "%Y-%m-%d")
        except (KeyError, ValueError) as exc:
            logger.warning("Skipping scenario %s: bad date — %s", key, exc)
            continue
        title_en = str(entry.get("en", "")).strip()
        title_jp = str(entry.get("jp", "")).strip()
        art_url = str(entry.get("art", "")).strip() or None
        if not title_en and not title_jp:
            logger.warning("Skipping scenario %s: no title", key)
            continue
        records.append(
            {
                "key": str(key),
                "title_en": title_en,
                "title_jp": title_jp,
                "art_url": art_url,
                "period": Period(
                    start=datetime(d.year, d.month, d.day, _SCENARIO_HOUR, tzinfo=JST)
                ),
                "source": source,
            }
        )
    logger.info("Loaded %d scenarios from %s", len(records), path.name)
    return records
