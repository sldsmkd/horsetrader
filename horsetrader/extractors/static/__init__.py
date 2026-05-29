from horsetrader.core import Period, SingletonMeta
from horsetrader.semantics import transcend

from . import anniversaries as _anniversaries
from . import banners as _banners
from . import holidays as _holidays
from . import scenarios as _scenarios
from . import stories as _stories


@transcend
class Static(metaclass=SingletonMeta):
    """Facade for static file data extraction.

    Returns raw record dicts and core primitives; entity construction is
    Digitan's responsibility (see [[project-transcend-digitan-boundary]]).
    """

    def anniversaries(self) -> list[dict]:
        """Records from jp.anniversaries.yaml merged with en.anniversaries.yaml."""
        return _anniversaries.load()

    def scenarios(self) -> list[dict]:
        """Records from jp.scenarios.yaml merged with en.scenarios.yaml.

        Each record has key, title_en, title_jp, art_url, period, source,
        and an 'en' key (dict | None) with the EN period, title, and source.
        """
        return _scenarios.load()

    def holidays(self) -> list[dict]:
        """Records from holidays.yaml (consolidated JP + EN).

        Each record has key, name, period (JP), source, and an 'en' key
        (dict | None) with the EN period and source when present.
        """
        return _holidays.load()

    def story_banners(self) -> list[dict]:
        """Banner image records from references/stories/, sorted by ordinal.

        Each record has ``n`` (1-based ordinal) and ``banner_path`` (Path).
        """
        return _stories.load()

    def banner_period(self, key: str) -> Period | None:
        """UTC Period for the EN banner with this key, or None if not in en.banners.yaml."""
        entry = _banners.load().get(key)
        if entry is None:
            return None
        return _banners.to_period(*entry)

    def story_period(self, key: str) -> Period | None:
        """UTC Period for the EN story with this stable key, or None if not in stories.yaml."""
        entry = _stories.load_en().get(key)
        return entry["period"] if entry else None

    def story_name_override(self, key: str) -> str | None:
        """Maintainer-curated EN title for this story (fansub default, Cygames-official
        when shipped), or None if no override is recorded in stories.yaml.
        """
        entry = _stories.load_en().get(key)
        return entry["name"] if entry else None
