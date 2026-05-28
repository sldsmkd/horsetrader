from horsetrader.core import Period, SingletonMeta
from horsetrader.semantics import transcend

from . import banners as _banners
from . import en_scenarios as _en_scenarios
from . import scenarios as _scenarios


@transcend
class Static(metaclass=SingletonMeta):
    """Facade for static file data extraction.

    Returns raw record dicts and core primitives; entity construction is
    Digitan's responsibility (see [[project-transcend-digitan-boundary]]).
    """

    def scenarios(self) -> list[dict]:
        """Records from jp.scenarios.yaml, each with an 'en' key (dict | None) for EN data."""
        en = _en_scenarios.load()
        return [{**r, "en": en.get(r["key"])} for r in _scenarios.load()]

    def banner_period(self, key: str) -> Period | None:
        """UTC Period for the EN banner with this key, or None if not in en.banners.yaml."""
        entry = _banners.load().get(key)
        if entry is None:
            return None
        return _banners.to_period(*entry)
