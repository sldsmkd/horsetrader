import json
import re

from horsetrader.core import Japlish, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

_OUTFIT_LIST_URL_PREFIX = "https://umapyoi.net/api/v1/outfit/character"

# Some umapyoi EN titles are dirty with a doubled outer bracket pair
# ("[[unsigned]]") where the dataset's convention is a single pair
# ("[Special Dreamer]"). Collapse the redundant wrap to one.
_DOUBLED_BRACKETS = re.compile(r"^\[(\[[^\[\]]*\])\]$")


def _normalise_title(value: str) -> str:
    match = _DOUBLED_BRACKETS.match(value)
    return match.group(1) if match else value


@transcend
class UmapyoiTrainees(metaclass=SingletonMeta):
    """Outfit-list scraper for umapyoi.net trainee titles.

    Owns the per-character outfit endpoint and resolves the EN title for a
    given trainee_id. Returns raw record dicts; entity construction is
    Digitan's responsibility.
    """

    def __init__(self):
        self._uc = UmaClient()
        self._outfit_cache: dict[int, list[dict]] = {}

    @staticmethod
    def _build_title(title_jp: object, title_en: object) -> Japlish | None:
        """Assemble the bilingual flavour title from the outfit's two fields.

        The EN slot is set with an explicit ``encoding="en"`` rather than via
        auto-detection: some EN titles carry a katakana middle-dot (U+30FB, e.g.
        "Jubilant Star・Auspicious Crane") which would otherwise be mis-sniffed
        as Japanese and the translation silently dropped.
        """
        jp = title_jp.strip() if isinstance(title_jp, str) and title_jp.strip() else None
        en = title_en.strip() if isinstance(title_en, str) and title_en.strip() else None
        if jp is None and en is None:
            return None
        if jp:
            jp = _normalise_title(jp)
        if en:
            en = _normalise_title(en)

        title = Japlish(jp) if jp else Japlish(en, encoding="en")  # type: ignore[arg-type]
        if en and jp:
            title.en = en
        return title

    def _outfits(self, gametora_id: int) -> list[dict]:
        cached = self._outfit_cache.get(gametora_id)
        if cached is not None:
            return list(cached)

        url = f"{_OUTFIT_LIST_URL_PREFIX}/{gametora_id}"
        response = self._uc.get(url, cache=CacheTime.LEAF)
        if isinstance(response, bytes):
            raise RuntimeError(f"Expected text response from {url}, got bytes")

        payload = json.loads(response)
        if not isinstance(payload, list):
            raise RuntimeError(
                f"Expected list response from {url}, got {type(payload).__name__}"
            )

        self._outfit_cache[gametora_id] = payload
        return list(payload)

    def trainee(self, trainee_id: int, gametora_id: int) -> dict:
        """Fetch the umapyoi outfit record for a specific trainee.

        Returns a raw record dict (no Trainee construction — that's Digitan's
        job). `title` is the outfit's unique *flavour* title (e.g. "[Jubilant
        Star・Auspicious Crane]"), NOT the costume category — that's the
        `CostumeVariants` enum's job. The returned `Japlish` carries the JP base
        plus an EN translation when umapyoi has one; `None` when the outfit
        carries neither.
        """
        if trainee_id <= 0 or gametora_id <= 0:
            raise ValueError("trainee_id and gametora_id must be positive integers")

        url = f"{_OUTFIT_LIST_URL_PREFIX}/{gametora_id}"
        outfits = self._outfits(gametora_id)

        title: Japlish | None = None
        for outfit in outfits:
            outfit_id = outfit.get("id")
            try:
                if int(outfit_id) != trainee_id:
                    continue
            except (TypeError, ValueError):
                continue
            title = self._build_title(outfit.get("title"), outfit.get("title_en"))
            break

        logger.info(
            f"Fetched umapyoi outfit for trainee_id={trainee_id} gametora_id={gametora_id}"
        )

        return {
            "title": title,
            "references": [url],
        }
