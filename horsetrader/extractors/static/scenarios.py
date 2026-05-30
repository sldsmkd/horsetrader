import functools
import re

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^scenario-\d{2}$")


def _require_name(value, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string; got {value!r}")
    return value.strip()


@functools.cache
def load() -> list[dict]:
    """Records from the consolidated ``static/scenarios.yaml`` (JP + EN).

    Each record has ``key``, ``title_jp``, ``title_en``, ``art_url``,
    ``period`` (JP launch), ``source``, and an ``en`` key (``dict | None``)
    carrying the EN ``period`` + ``title_en`` — present only once a scenario
    has reached the Global server (its ``en`` block has a ``start``).

    Entries are selected by the ``scenario-NN`` key shape, corpus-wide — which
    file they live in is irrelevant.
    """
    source = store.source()
    records: list[dict] = []
    for key in store.select(_KEY_PATTERN):
        jp_block = store.overlay(key, "jp")
        if jp_block is None:
            raise ValueError(f"{source}: scenario {key!r} is missing required 'jp' block")
        jp_start = store.require_zone(
            jp_block.get("start"), JST, f"{source}: scenario {key!r} jp.start"
        )
        title_jp = _require_name(jp_block.get("name"), f"{source}: scenario {key!r} jp.name")

        title_en = ""
        en: dict | None = None
        en_block = store.overlay(key, "en")
        if en_block is not None:
            title_en = _require_name(
                en_block.get("name"), f"{source}: scenario {key!r} en.name"
            )
            if en_block.get("start") is not None:
                en_start = store.require_zone(
                    en_block.get("start"), UTC, f"{source}: scenario {key!r} en.start"
                )
                en = {
                    "title_en": title_en,
                    "period": Period(start=en_start),
                    "source": source,
                }

        art = store.shared(key).get("art")
        art_url = str(art).strip() if art else None

        records.append({
            "key": str(key),
            "title_jp": title_jp,
            "title_en": title_en,
            "art_url": art_url,
            "period": Period(start=jp_start),
            "source": source,
            "en": en,
        })
    logger.info("Loaded %d scenarios", len(records))
    return records
