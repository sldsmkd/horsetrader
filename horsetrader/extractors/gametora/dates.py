import re
from datetime import datetime
from zoneinfo import ZoneInfo

from horsetrader.core import JST, Period
from horsetrader.transport import CHROME_TIMEZONE

# Gametora renders dates as English prose ("1 Jan 2021 – 15 Jan 2021") rather
# than a machine-readable format. These helpers centralise the parsing so every
# banner/event extractor can import them instead of duplicating the month dict.
#
# Two kinds of Gametora date, which must not be confused:
#
# - **Static calendar dates** (banner pages, release dates) are plain strings in
#   the HTML. `parse_date` stamps them as the JP-server content-drop instant:
#   12:00 JST on the listed calendar day (= reset 00:00 JST + 12h drop interval).
# - **Rendered datetimes** (missions, Champions Meeting, Legend Races, story
#   events) are formatted client-side from an instant, in the *browser's*
#   timezone — never JST/UTC by page locale. `UmaClient` pins Chrome to
#   `CHROME_TIMEZONE`, and `rendered_instant` is the one place that reads a
#   rendered wall-clock back into an aware instant.

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
    """Parse a Gametora prose date like "1 Jan 2021" into the JST content-drop instant."""
    parts = value.strip().split()
    if len(parts) != 3:
        raise ValueError(f"Cannot parse Gametora date: {value!r}")
    day = int(parts[0])
    month = _MONTHS.get(parts[1].lower().rstrip("."))
    if month is None:
        raise ValueError(f"Unknown month token in Gametora date: {parts[1]!r}")
    return datetime(
        year=int(parts[2]),
        month=month,
        day=day,
        hour=12,
        tzinfo=JST,
    )


def rendered_instant(wall_clock: datetime) -> datetime:
    """The aware instant behind a naive wall-clock Gametora rendered in Chrome.

    Callers convert to the zone their model wants (JST for the JP substrate,
    UTC for the EN overlay) with `.astimezone()` — never `.replace(tzinfo=…)`,
    which would relabel the browser's wall-clock as a different zone.
    """
    if wall_clock.tzinfo is not None:
        raise ValueError("rendered wall-clock must be naive")
    return wall_clock.replace(tzinfo=ZoneInfo(CHROME_TIMEZONE))


def parse_period(raw_text: str) -> Period:
    """Extract a Period from a Gametora text block containing a date range."""
    collapsed = " ".join(raw_text.replace("\xa0", " ").split())
    match = _DATE_RANGE_PATTERN.search(collapsed)
    if match is None:
        raise ValueError(f"Cannot parse Gametora date range: {collapsed!r}")
    start = parse_date(match.group("start"))
    end = parse_date(match.group("end"))
    return Period(start=start, span=end - start)
