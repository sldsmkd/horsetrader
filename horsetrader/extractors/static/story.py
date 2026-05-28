import re
from pathlib import Path

from horsetrader.core import Config
from horsetrader.info import Logger

logger = Logger.get(__name__)

_BANNER_PATTERN = re.compile(r"^story_(\d+)_banner\.png$")


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
