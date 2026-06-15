from enum import Enum

_SURFACE_JP = {"芝": "turf", "ダート": "dirt"}


class Surface(Enum):
    """A course's running surface — 芝 (Turf) or ダート (Dirt)."""

    TURF = "turf"
    DIRT = "dirt"

    @classmethod
    def from_en(cls, text: str) -> "Surface | None":
        """Resolve a Gametora EN surface label ("Turf", "Dirt")."""
        try:
            return cls(text.strip().lower())
        except ValueError:
            return None

    @classmethod
    def from_jp(cls, text: str) -> "Surface | None":
        """Resolve a Gametora JP surface label (芝 / ダート)."""
        slug = _SURFACE_JP.get(text.strip()) if text else None
        return cls(slug) if slug else None

    def match(self, query: str) -> bool:
        return query.lower() in self.value
