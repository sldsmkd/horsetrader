import functools
import re

from horsetrader.core import Config, UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_BANNER_PATTERN = re.compile(r"^story_(\d+)_banner\.png$")
_KEY_PATTERN = re.compile(r"^story-\d{3}$")


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
def load_en() -> dict[str, dict]:
    """Return EN overlay per stable key.

    Each value is a dict with ``period`` (UTC :class:`Period`) and ``name``
    (optional ``str`` — Cygames-official EN title overriding Gametora's
    scraped fansub).
    """
    filename = "stories.yaml"
    source = str(Config().static / filename)
    out: dict[str, dict] = {}
    for key in store.load(filename):
        if not _KEY_PATTERN.match(str(key)):
            raise ValueError(
                f"{source}: story key {key!r} must be a zero-padded stable key "
                f"matching {_KEY_PATTERN.pattern}"
            )
        en_block = store.overlay(filename, key, "en")
        if en_block is None:
            raise ValueError(f"{source}: story {key!r} is missing required 'en' block")

        start = store.require_zone(
            en_block.get("start"), UTC, f"{source}: story {key!r} en.start"
        )
        end = store.require_zone(
            en_block.get("end"), UTC, f"{source}: story {key!r} en.end"
        )
        name_raw = en_block.get("name")
        if name_raw is not None and not isinstance(name_raw, str):
            raise ValueError(
                f"{source}: story {key!r} en.name must be a string; got {name_raw!r}"
            )
        name = name_raw.strip() if name_raw else None

        out[str(key)] = {
            "period": Period(start=start, span=end - start),
            "name": name or None,
        }
    logger.info("Loaded %d EN stories from %s", len(out), filename)
    return out
