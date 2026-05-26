from lxml.html import HtmlElement
from lxml.etree import _Element
from typing import Optional


def xpath_all(node: HtmlElement, expr: str) -> list[_Element]:
    """Return all XPath matches as a list (empty if none)."""
    return node.xpath(expr)


def xpath_first(node: HtmlElement, expr: str) -> Optional[HtmlElement]:
    """Return the first XPath match or None."""
    results = node.xpath(expr)
    return results[0] if results else None


def xpath_attr(node: HtmlElement, expr: str, attr: str) -> Optional[str]:
    """Return `attr` from the first XPath match, or None."""
    match = xpath_first(node, expr)
    return match.get(attr) if match is not None else None


def strip_affixes(value: str, prefix: str = "", suffix: str = "") -> Optional[str]:
    """Strip known prefix and suffix from a string, or return None if they don't match."""
    if prefix and not value.startswith(prefix):
        return None
    if suffix and not value.endswith(suffix):
        return None
    start = len(prefix)
    end = len(value) - len(suffix) if suffix else None
    return value[start:end]
