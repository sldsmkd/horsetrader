import functools
import re

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

# Main-story chapters, keyed `main-story-NN`. A permanent one-time campaign (see
# config/yaml/main_story.yaml's header) — each chapter is a single-day welfare
# milestone, not a windowed event, so periods are span-0 launch points.
_KEY_PATTERN = re.compile(r"^main-story-\d{2}$")


def _require_name(value, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string; got {value!r}")
    return value.strip()


def _flatten_carats(block, label: str) -> int:
    """Flatten a chapter's `clear_carats` to a single total. The per-episode jewels
    all land on the one release day, so `episodes × each (+ optional bonus)` collapses
    to a flat grant — the model hands it out as one `FreeCarats` on the release date."""
    if not isinstance(block, dict):
        raise ValueError(f"{label} must be a mapping; got {block!r}")
    episodes = block.get("episodes")
    each = block.get("each")
    bonus = block.get("bonus", 0)
    for name, val in (("episodes", episodes), ("each", each), ("bonus", bonus)):
        if not isinstance(val, int):
            raise ValueError(f"{label}.{name} must be an int; got {val!r}")
    return episodes * each + bonus


@functools.cache
def load() -> list[dict]:
    """Curated main-story chapters from main_story.yaml (JP + optional EN).

    Each record has ``key``, ``title_jp``, ``title_en`` (``""`` until Global),
    ``period`` (JP launch, span-0), ``rewards`` (the welfare card stable keys —
    ``support-*`` plus the finale ``trainee-*``), ``carats`` (the flattened
    story-clear total), ``banner`` (a local filename OR a remote URL; the model
    discriminates on the ``http(s)://`` prefix), ``source``, and an ``en`` key
    (``dict | None``) carrying the EN ``period`` + ``title_en`` once a chapter has
    reached Global. Selected by the ``main-story-NN`` key shape, corpus-wide.

    Curated input — fails loud on bad data ([[feedback-curated-yaml-fails-loud]]).
    """
    source = store.source()
    records: list[dict] = []
    for key in store.select(_KEY_PATTERN):
        where = f"{source}: main story {key!r}"

        jp_block = store.overlay(key, "jp")
        if jp_block is None:
            raise ValueError(f"{where} is missing required 'jp' block")
        jp_start = store.require_zone(jp_block.get("start"), JST, f"{where} jp.start")
        title_jp = _require_name(jp_block.get("name"), f"{where} jp.name")

        title_en = ""
        en: dict | None = None
        en_block = store.overlay(key, "en")
        if en_block is not None:
            title_en = _require_name(en_block.get("name"), f"{where} en.name")
            en_start = store.require_zone(
                en_block.get("start"), UTC, f"{where} en.start"
            )
            en = {
                "title_en": title_en,
                "period": Period(start=en_start),
                "source": source,
            }

        top = store.shared(key)
        rewards = top.get("rewards")
        if not isinstance(rewards, list) or not rewards:
            raise ValueError(f"{where}: 'rewards' must be a non-empty list of stable keys")
        carats = _flatten_carats(top.get("clear_carats"), f"{where} clear_carats")
        banner = top.get("banner")
        banner = str(banner).strip() if banner else None

        records.append({
            "key": str(key),
            "title_jp": title_jp,
            "title_en": title_en,
            "period": Period(start=jp_start),
            "rewards": [str(r) for r in rewards],
            "carats": carats,
            "banner": banner,
            "source": source,
            "en": en,
        })
    logger.info("Loaded %d main story chapters", len(records))
    return records
