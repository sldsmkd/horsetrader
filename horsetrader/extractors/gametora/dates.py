import re
from datetime import datetime

from horsetrader.core import Period

# Gametora renders dates as English prose ("1 Jan 2021 – 15 Jan 2021") rather
# than a machine-readable format. These helpers centralise the parsing so every
# banner/event extractor can import them instead of duplicating the month dict.

_MONTHS: dict[str, int] = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

_DATE_RANGE_PATTERN = re.compile(
    r"(?P<start>\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})"
    r"\s*[–\-]\s*"
    r"(?P<end>\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})"
)


def parse_date(value: str) -> datetime:
    """Parse a Gametora prose date like "1 Jan 2021" into a datetime."""
    parts = value.strip().split()
    if len(parts) != 3:
        raise ValueError(f"Cannot parse Gametora date: {value!r}")
    day = int(parts[0])
    month = _MONTHS.get(parts[1].lower().rstrip("."))
    if month is None:
        raise ValueError(f"Unknown month token in Gametora date: {parts[1]!r}")
    return datetime(year=int(parts[2]), month=month, day=day)


def parse_period(raw_text: str) -> Period:
    """Extract a Period from a Gametora text block containing a date range."""
    collapsed = " ".join(raw_text.replace("\xa0", " ").split())
    match = _DATE_RANGE_PATTERN.search(collapsed)
    if match is None:
        raise ValueError(f"Cannot parse Gametora date range: {collapsed!r}")
    start = parse_date(match.group("start"))
    end = parse_date(match.group("end"))
    return Period(start=start, span=end - start)
