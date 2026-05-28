import functools
import re
from datetime import date, datetime, timezone

import yaml

from horsetrader.core import Config, Period
from horsetrader.info import Logger

logger = Logger.get(__name__)

_BANNER_PATTERN = re.compile(r"^story_(\d+)_banner\.png$")
_KEY_PATTERN = re.compile(r"^story-(\d+)$")
_EN_HOUR = 22  # Stories drop at 22:00 UTC on content refresh


def load() -> list[dict]:
    """Return story banner records from references/stories/, sorted by ordinal."""
    refs_dir = Config().references / "stories"
    records = []
    for path in refs_dir.glob("story_*_banner.png"):
        m = _BANNER_PATTERN.match(path.name)
        if m is None:
            continue
        records.append({"n": int(m.group(1)), "banner_path": path})
    records.sort(key=lambda r: r["n"])
    logger.info("Found %d story banner(s) in references", len(records))
    return records


@functools.cache
def load_en() -> dict[str, Period]:
    """Return EN story periods keyed by zero-padded stable key (story-NNN)."""
    path = Config().static / "en.stories.yaml"
    if not path.exists():
        return {}
    with path.open() as f:
        raw = yaml.safe_load(f) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{path} is empty or not a mapping")

    out: dict[str, Period] = {}
    for key, entry in raw.items():
        m = _KEY_PATTERN.match(str(key))
        if m is None or not isinstance(entry, dict):
            continue
        try:
            start: date = entry["start"]
            end: date = entry["end"]
        except KeyError as exc:
            logger.warning("Skipping EN story %s: missing %s", key, exc)
            continue
        stable = f"story-{int(m.group(1)):03d}"
        utc_start = datetime(start.year, start.month, start.day, _EN_HOUR, tzinfo=timezone.utc)
        utc_end = datetime(end.year, end.month, end.day, _EN_HOUR, tzinfo=timezone.utc)
        out[stable] = Period(start=utc_start, span=utc_end - utc_start)
    return out
