from pathlib import Path

from horsetrader.core import Config


def image(name: str) -> Path | None:
    """Return a curated misc image path from config/img/misc/, if present."""
    path = Config().curated / "img" / "misc" / name
    return path if path.exists() else None
