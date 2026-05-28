from pathlib import Path

from horsetrader.core import Config, Period, SingletonMeta
from horsetrader.semantics import transcend

from . import banners as _banners


@transcend
class Static(metaclass=SingletonMeta):
    """Facade for static file data extraction.

    Returns raw record dicts and core primitives; entity construction is
    Digitan's responsibility (see [[project-transcend-digitan-boundary]]).
    """

    def __init__(self) -> None:
        self.en_banners_path: Path = Config().global_dir / "en.banners.yaml"
        self._en_banners = _banners.parse(self.en_banners_path)

    def banner_period(self, key: str) -> Period | None:
        """UTC Period for the EN banner with this key, or None if not in en.banners.yaml."""
        entry = self._en_banners.get(key)
        if entry is None:
            return None
        return _banners.to_period(*entry)
