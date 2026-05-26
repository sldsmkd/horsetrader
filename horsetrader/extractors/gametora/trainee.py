import re
from datetime import datetime

from lxml import html

from horsetrader.core import Period, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.extractors.helpers import xpath_first
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

_TRAINEE_PAGE_URL_PREFIX = "https://gametora.com/ja/umamusume/characters/"
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
                date_str = f"{match.group(1)}-{match.group(2):0>2}-{match.group(3):0>2}"
                return Period(datetime.strptime(date_str, "%Y-%m-%d"))
        raise ValueError("Could not extract release date from trainee page")

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
            "release": self._extract_release_date(tree),
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
