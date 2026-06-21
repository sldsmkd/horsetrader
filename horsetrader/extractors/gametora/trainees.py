import re
from typing import Sequence

from lxml import html

from horsetrader.core import SingletonMeta
from horsetrader.enums import CacheTime, CostumeVariants, Sources
from horsetrader.extractors.helpers import (
    strip_affixes,
    xpath_all,
    xpath_attr,
    xpath_first,
)
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

from .trainee import GametoraTrainee

logger = Logger.get(__name__)

_GAMETORA_BASE_URL = "https://gametora.com"
_TRAINEE_INDEX_URL = "https://gametora.com/ja/umamusume/characters"
_TRAINEE_INDEX_MAIN_BLOCK_EXPR = "//main"
_TRAINEE_HREF_PREFIX = "/ja/umamusume/characters/"
_TRAINEE_ANCHOR_EXPR = f'.//a[starts-with(@href, "{_TRAINEE_HREF_PREFIX}")]'
_TRAINEE_NAME_EXPR = './/div[contains(@class,"juvrzR")]//span[1]'
_TRAINEE_BADGE_EXPR = './/div[contains(@class,"juvrUN")]//span[1]'
_TRAINEE_SLUG_PATTERN = re.compile(r"^(?P<trainee_id>\d{6})-(?P<slug>.+)$")


@transcend
class GametoraTrainees(metaclass=SingletonMeta):
    """Scraper for trainee entries listed on the Gametora character index."""

    def __init__(self):
        self._uc = UmaClient()
        self._trainee_scraper = GametoraTrainee()

    @staticmethod
    def _variant_from_badge(badge: str) -> tuple[str, int]:
        _badge = badge.strip()
        if _badge in ("⭐", "⭐⭐", "⭐⭐⭐"):
            return "DEFAULT", len(_badge)
        if _badge:
            variant = CostumeVariants.from_jp(_badge)
            if variant is None:
                raise ValueError(
                    f"Unknown costume badge '{_badge}'. "
                    "Add it to _COSTUME_VARIANT_JP_MAP in enums/costume_variants.py"
                )
            return variant.name, 3
        return "DEFAULT", 3

    def trainees(self) -> Sequence[dict]:
        _tree = html.fromstring(
            self._uc.get(_TRAINEE_INDEX_URL, chrome=True, cache=CacheTime.INDEX)
        )

        main_block = xpath_first(_tree, _TRAINEE_INDEX_MAIN_BLOCK_EXPR)
        if main_block is None:
            logger.error("Main block not found")
            raise ValueError("Main block not found")

        anchors = xpath_all(main_block, _TRAINEE_ANCHOR_EXPR)
        if not anchors:
            logger.error("No trainee anchors found")
            raise ValueError("No trainee anchors found")

        records: list[dict] = []
        for anchor in anchors:
            href = xpath_attr(anchor, ".", "href")
            if not href:
                continue

            slug = strip_affixes(href, _TRAINEE_HREF_PREFIX)
            if not slug:
                continue

            slug_match = _TRAINEE_SLUG_PATTERN.match(slug)
            if slug_match is None:
                continue

            trainee_id = int(slug_match.group("trainee_id"))
            character_gametora_id = trainee_id // 100

            name_node = xpath_first(anchor, _TRAINEE_NAME_EXPR)
            badge_node = xpath_first(anchor, _TRAINEE_BADGE_EXPR)
            badge = (
                badge_node.text_content().strip() if badge_node is not None else ""
            )
            variant_name, rarity = self._variant_from_badge(badge)

            thumbnail_path = (
                "/images/umamusume/characters/thumb/"
                f"chara_stand_{character_gametora_id}_{trainee_id}.png"
            )
            portrait_path = thumbnail_path.replace("/thumb/", "/")

            record: dict = {
                "slug": slug,
                "trainee_id": trainee_id,
                "character_gametora_id": character_gametora_id,
                "name_jp": (
                    name_node.text_content().strip()
                    if name_node is not None
                    else ""
                ),
                "badge": badge,
                "variant_name": variant_name,
                "rarity": rarity,
                "thumbnail_url": f"{_GAMETORA_BASE_URL}{thumbnail_path}",
                "portrait_url": f"{_GAMETORA_BASE_URL}{portrait_path}",
            }

            record.update(self._trainee_scraper.trainee(record))
            records.append(record)

        logger.info(f"Extracted {len(records)} trainees from Gametora")

        out: list[dict] = []
        for record in records:
            slug = record["slug"]
            trainee_id = record["trainee_id"]

            correlations: dict[str, int] = {
                Sources.GAMETORA.value: trainee_id,
            }

            references = [_TRAINEE_INDEX_URL]
            detail_url = record.get("source_url")
            if isinstance(detail_url, str) and detail_url:
                references.append(detail_url)

            out.append(
                {
                    "key": slug,
                    "trainee_id": trainee_id,
                    "character_gametora_id": record["character_gametora_id"],
                    "release": record["release"],
                    "variant_name": record["variant_name"],
                    "rarity": record["rarity"],
                    # The unique flavour title is the umapyoi enricher's job; the
                    # Gametora index only carries the costume *category* (badge →
                    # CostumeVariants), which rides `variant_name`. Conflating the
                    # two here is exactly the bug this split fixes.
                    "thumbnail_url": record["thumbnail_url"],
                    "portrait_url": record["portrait_url"],
                    # Canonical reader-facing deep-link (Gametora EN page), reported
                    # by the detail scraper — not sniffed back out of `references`.
                    "source": record.get("source"),
                    # Base aptitudes ({axis: {slot: AptitudeRank}}) from the detail
                    # scraper; the model folds them into an `Aptitudes`.
                    "aptitudes": record.get("aptitudes"),
                    "correlations": correlations,
                    "references": references,
                }
            )

        return out
