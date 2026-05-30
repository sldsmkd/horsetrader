from horsetrader.core import Period, SingletonMeta
from horsetrader.semantics import transcend

from . import anchored as _anchored
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
        """Records from the consolidated anniversaries.yaml (JP + EN)."""
        return _anniversaries.load()

    def anchored_events(self) -> list[dict]:
        """Curated lead-ins / extensions, inlined across the consolidated files
        and gathered from the merged store by key prefix.

        Each record has key, relation ('before'|'after'), anchor (stable key),
        name, duration (timedelta), a 'rewards' key (baked-shape mapping | None),
        and source. The anchor is resolved against other event collections at
        model-build time, so no period is computed here.
        """
        return _anchored.load()

    def scenarios(self) -> list[dict]:
        """Records from the consolidated scenarios.yaml (JP + EN).

        Each record has key, title_en, title_jp, art_url, period, source,
        and an 'en' key (dict | None) with the EN period, title, and source.
        """
        return _scenarios.load()

    def holidays(self) -> list[dict]:
        """Records from holidays.yaml (consolidated JP + EN).

        Each record has key, name, period (JP), source, a 'rewards' key
        (the curated baked-shape mapping | None), and an 'en' key
        (dict | None) with the EN period and source when present.
        """
        return _holidays.load()

    def story_banners(self) -> list[dict]:
        """Banner image records from static/img/stories/, sorted by ordinal.

        Each record has ``n`` (1-based ordinal) and ``banner_path`` (Path).
        """
        return _stories.load()

    def banner_period(self, key: str) -> Period | None:
        """UTC Period for the EN banner with this key, or None if not in banners.yaml."""
        return _banners.load().get(key)

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
