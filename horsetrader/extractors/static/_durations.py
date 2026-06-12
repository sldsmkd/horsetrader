import re
from datetime import timedelta

# ISO-8601 duration, restricted to the components that map to a fixed
# `timedelta`. Years and months are deliberately unrepresentable here — they
# aren't a constant number of days — so `P1Y` / `P1M` fail to match and raise.
_DURATION = re.compile(
    r"^P(?=\d|T\d)(?:(\d+)W)?(?:(\d+)D)?(?:T(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$"
)


def parse_duration(value: object, label: str) -> timedelta:
    """Parse an ISO-8601 duration (`P7D`, `P2W`, `PT12H`, …) to a `timedelta`.

    Curated data fails loud: an absent, non-string, year/month, or otherwise
    malformed value raises so the pipeline run is the editor's feedback loop.
    """
    if not isinstance(value, str):
        raise ValueError(f"{label}: duration must be an ISO-8601 string; got {value!r}")
    m = _DURATION.match(value)
    if m is None:
        raise ValueError(
            f"{label}: {value!r} is not a supported ISO-8601 duration "
            f"(weeks/days/hours/minutes/seconds only; no years/months)"
        )
    weeks, days, hours, minutes, seconds = (int(g) if g else 0 for g in m.groups())
    return timedelta(weeks=weeks, days=days, hours=hours, minutes=minutes, seconds=seconds)
