"""Data provenance tracking for Tracen models via source references."""

from pathlib import Path
from typing import Union

from horsetrader.semantics import tazuna


@tazuna
class References(list):
    """
    A list of data sources (URLs, file paths, or strings) that contributed to generating a record.

    Tracks provenance by recording all sources consulted during extraction, enrichment, and merge.
    Supports mixed types: URL strings, Path objects, or custom source identifiers.

    Example:
        refs = References()
        refs.append("https://gametora.com/character/1002")
        refs.append(Path("/cache/umapyoi_characters.json"))
        print(refs)  # ["https://gametora.com/character/1002", Path("/cache/umapyoi_characters.json")]
    """

    def __init__(self, initial: list | None = None):
        """Initialize with optional list of sources."""
        super().__init__(initial or [])

    def add(self, source: Union[str, Path, "References"]) -> None:
        """
        Add a source to the references list.

        Args:
            source: URL string, file Path, or another References object (will extend, not append).

        Example:
            refs.add("https://example.com")
            refs.add(Path("/data/cache.json"))
            other_refs = References(["https://other.com"])
            refs.add(other_refs)  # Extends with other_refs contents
        """
        if isinstance(source, References):
            self.extend(source)
        else:
            self.append(source)

    def __repr__(self) -> str:
        """Pretty repr showing all references."""
        items = [repr(item) for item in self]
        return f"References({items})"

    def __str__(self) -> str:
        """Human-readable list of sources."""
        return "\n".join(str(item) for item in self)
