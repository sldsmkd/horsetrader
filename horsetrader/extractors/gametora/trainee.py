import re
from datetime import datetime

from lxml import html

from horsetrader.core import JST, Period, SingletonMeta
from horsetrader.enums import AptitudeRank, CacheTime
from horsetrader.extractors.helpers import xpath_first
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

_TRAINEE_PAGE_URL_PREFIX = "https://gametora.com/ja/umamusume/characters/"
# Gametora's English mirror of the same page (the `/ja/` page is Japanese). The
# detail is fetched in JP for the infobox, but the deep-link target is English.
_TRAINEE_PAGE_EN_URL_PREFIX = "https://gametora.com/umamusume/characters/"
_TRAINEE_ID_PREFIX_PATTERN = re.compile(r"^(?P<trainee_id>\d+)-")
_RELEASE_DATE_PATTERN = re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日")

_TRAINEE_NAME_EXPR = (
    '(//div[contains(@class, "characters_infobox_character_name__")][1] '
    '| //main//div[contains(@class, "juvrzR")]//span[1] '
    "| //main//h1[1])[1]"
)
_TRAINEE_BADGE_EXPR = (
    '(//main//div[contains(@class, "juvrUN")]//span[1] '
    '| //main//span[contains(normalize-space(.), "⭐")][1])[1]'
)
_TRAINEE_INFOBOX_ROWS_EXPR = '//div[contains(@class, "characters_infobox_row")]'

# Aptitude block. Each grade is a letter-icon (rank/simple/NN.png) sitting in a
# cell next to its JP label (芝, 短距離, 逃げ, …). We key off the label so the
# axes stay anchored even if the page reorders. `alt`/`title` echo the letter,
# but the icon number is the canonical source we resolve through AptitudeRank.
_APTITUDE_ICON_EXPR = '//img[contains(@src, "/rank/simple/")]'
_APTITUDE_ICON_NUMBER_PATTERN = re.compile(r"/rank/simple/(\d+)\.png")
# JP label → (axis, slot) on the Aptitudes dataclasses.
_APTITUDE_LABELS: dict[str, tuple[str, str]] = {
    "芝": ("surface", "turf"),
    "ダート": ("surface", "dirt"),
    "短距離": ("distance", "short"),
    "マイル": ("distance", "mile"),
    "中距離": ("distance", "medium"),
    "長距離": ("distance", "long"),
    "逃げ": ("strategy", "front"),
    "先行": ("strategy", "pace"),
    "差し": ("strategy", "late"),
    "追込": ("strategy", "end"),
}
# How many grades each axis must carry for a complete aptitude block.
_APTITUDE_AXIS_SIZES: dict[str, int] = {}
for _axis, _slot in _APTITUDE_LABELS.values():
    _APTITUDE_AXIS_SIZES[_axis] = _APTITUDE_AXIS_SIZES.get(_axis, 0) + 1


@transcend
class GametoraTrainee(metaclass=SingletonMeta):
    """Scraper for individual trainee detail pages from Gametora."""

    def __init__(self):
        self._uc = UmaClient()

    @staticmethod
    def _trainee_id_from_slug(slug: str) -> int | None:
        match = _TRAINEE_ID_PREFIX_PATTERN.match(slug)
        if match is None:
            return None
        value = match.group("trainee_id")
        return int(value) if value.isdigit() else None

    @staticmethod
    def _extract_release_date(tree: html.HtmlElement) -> Period:
        for row in tree.xpath(_TRAINEE_INFOBOX_ROWS_EXPR):
            text = row.text_content()
            if "実装日" not in text:
                continue
            match = _RELEASE_DATE_PATTERN.search(text)
            if match:
                return Period(
                    datetime(
                        year=int(match.group(1)),
                        month=int(match.group(2)),
                        day=int(match.group(3)),
                        hour=12,
                        tzinfo=JST,
                    )
                )
        raise ValueError("Could not extract release date from trainee page")

    @staticmethod
    def _extract_aptitudes(tree: html.HtmlElement) -> dict[str, dict[str, AptitudeRank]] | None:
        """Read the aptitude block into `{axis: {slot: AptitudeRank}}`.

        Returns `None` if the page carries no aptitude icons at all; raises if
        the block is present but malformed (an unknown label, an unresolvable
        icon number, or a missing grade) — a partial aptitude set is a scrape
        bug, not a real trainee."""
        axes: dict[str, dict[str, AptitudeRank]] = {
            "surface": {},
            "distance": {},
            "strategy": {},
        }
        icons = tree.xpath(_APTITUDE_ICON_EXPR)
        if not icons:
            return None

        for icon in icons:
            label = icon.xpath("./../../div[1]")[0].text_content().strip()
            slot = _APTITUDE_LABELS.get(label)
            if slot is None:
                raise ValueError(f"Unknown aptitude label '{label}' on trainee page")
            axis, name = slot

            match = _APTITUDE_ICON_NUMBER_PATTERN.search(icon.get("src", ""))
            rank = AptitudeRank.from_icon(int(match.group(1))) if match else None
            if rank is None:
                raise ValueError(
                    f"Could not resolve aptitude rank for '{label}' "
                    f"(icon src {icon.get('src')!r})"
                )
            axes[axis][name] = rank

        for axis, slots in axes.items():
            if len(slots) != _APTITUDE_AXIS_SIZES[axis]:
                raise ValueError(f"Incomplete '{axis}' aptitudes: got {sorted(slots)}")
        return axes

    def trainee(self, record: dict) -> dict:
        slug = record.get("slug")
        if not isinstance(slug, str) or not slug:
            raise ValueError("Trainee record must include a non-empty string 'slug'")

        source_url = f"{_TRAINEE_PAGE_URL_PREFIX}{slug}"
        tree = html.fromstring(
            self._uc.get(source_url, chrome=True, cache=CacheTime.LEAF)
        )

        name_node = xpath_first(tree, _TRAINEE_NAME_EXPR)
        badge_node = xpath_first(tree, _TRAINEE_BADGE_EXPR)

        logger.info(f"Fetching trainee details for {slug} from Gametora")

        return {
            "trainee_id": self._trainee_id_from_slug(slug),
            "source_url": source_url,
            # The canonical reader-facing page — Gametora's English mirror; the
            # card surface deep-links here. Constructed, not fetched (JP is scraped).
            "source": f"{_TRAINEE_PAGE_EN_URL_PREFIX}{slug}",
            "release": self._extract_release_date(tree),
            # {axis: {slot: AptitudeRank}} (or None when no aptitude block).
            "aptitudes": self._extract_aptitudes(tree),
            "name_jp": (
                name_node.text_content().strip()
                if name_node is not None and name_node.text_content()
                else None
            ),
            "badge": (
                badge_node.text_content().strip()
                if badge_node is not None and badge_node.text_content()
                else None
            ),
        }
