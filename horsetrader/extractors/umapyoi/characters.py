import json
from collections.abc import Sequence

from horsetrader.core import SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

from .character import UmapyoiCharacter

logger = Logger.get(__name__)

_LIST_URL = "https://umapyoi.net/api/v1/character/list"
_MAPPING_URL = "https://umapyoi.net/api/v1/character"

# Gametora slug → Umapyoi slug exceptions for tag resolution.
_TAG_ALIASES = {
    "st-lite": "saint-lite",
    "sasami-anshinzawa": "sasami-anshinizawa",
}


@transcend
class UmapyoiCharacters(metaclass=SingletonMeta):
    """Character list + tag→game_id resolver for umapyoi.net.

    Owns the list endpoint and the web_id↔game_id mapping endpoint. Delegates
    per-character detail fetching to `UmapyoiCharacter`. Returns raw record
    dicts; entity construction is Digitan's responsibility.
    """

    def __init__(self):
        self._uc = UmaClient()
        self._character_scraper = UmapyoiCharacter()
        self._list_cache: list | None = None
        self._mapping_cache: list | None = None

    def _get_list(self) -> list:
        cache = self._list_cache
        if cache is None:
            response = self._uc.get(_LIST_URL, cache=CacheTime.INDEX)
            if isinstance(response, bytes):
                raise RuntimeError(
                    f"Expected text response from {_LIST_URL}, got bytes"
                )
            cache = json.loads(response)
            self._list_cache = cache
        return cache

    def _get_mapping(self) -> list:
        cache = self._mapping_cache
        if cache is None:
            response = self._uc.get(_MAPPING_URL, cache=CacheTime.INDEX)
            if isinstance(response, bytes):
                raise RuntimeError(
                    f"Expected text response from {_MAPPING_URL}, got bytes"
                )
            cache = json.loads(response)
            self._mapping_cache = cache
        return cache

    def _resolve_tag_to_game_id(self, tag: str) -> int:
        """Resolve a Gametora slug (or Umapyoi internal tag) to its game_id."""
        resolved_tag = _TAG_ALIASES.get(tag, tag)

        list_data = self._get_list()
        web_id = None
        for item in list_data:
            if (
                item.get("name_en_internal") == resolved_tag
                or item.get("preferred_url") == resolved_tag
            ):
                web_id = item.get("id")
                break
        if web_id is None:
            raise ValueError(f"Character '{resolved_tag}' not found in list")

        mapping = self._get_mapping()
        game_id = None
        for item in mapping:
            if item.get("web_id") == web_id:
                game_id = item.get("game_id")
                break
        if game_id is None:
            # Umapyoi detail endpoint also accepts web_id when game_id mapping
            # is temporarily absent from /api/v1/character — a handled fallback,
            # not a surprise, so debug rather than warn.
            logger.debug(
                "No game_id mapping found for web_id %s; using web_id as detail id fallback",
                web_id,
            )
            game_id = web_id

        if resolved_tag != tag:
            logger.info(f"Resolved alias '{tag}' -> '{resolved_tag}'")
        logger.info(f"Resolved '{resolved_tag}' → web_id {web_id} → game_id {game_id}")
        return game_id

    def character(self, key: str) -> dict:
        """Fetch a single character by canonical key (Gametora slug or Umapyoi tag)."""
        normalized_key = key.strip()
        if not normalized_key:
            raise ValueError("Character key cannot be empty")

        game_id = self._resolve_tag_to_game_id(normalized_key)
        record = self._character_scraper.character(str(game_id))
        record["key"] = normalized_key
        # Add tag-resolution endpoints to references alongside the detail URL.
        record.setdefault("references", []).extend([_LIST_URL, _MAPPING_URL])
        return record

    def characters(self) -> Sequence[dict]:
        """Fetch all characters from the umapyoi list endpoint (with detail enrichment)."""
        list_data = self._get_list()
        logger.info(f"Fetched character list from umapyoi: {len(list_data)} items")

        out: list[dict] = []
        for item in list_data:
            tag = item.get("name_en_internal")
            if not tag:
                continue
            try:
                out.append(self.character(tag))
            except Exception as e:
                logger.warning(f"Failed to fetch character {tag}: {e}")

        logger.info(f"Fetched {len(out)} characters from umapyoi")
        return out
