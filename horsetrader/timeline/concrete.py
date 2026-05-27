from datetime import date, datetime, timezone

import yaml

from horsetrader.core import Config, Period
from horsetrader.semantics import tachyon

from .timeline import Timeline

_LAUNCH_HOUR = 22


@tachyon
class Concrete:
    """Hand-curated global event schedule from global/schedule.yaml.

    Deals exclusively in what IS — confirmed EN dates, either already live or
    officially announced. Maps stable JP event keys to their EN (UTC) start/end
    dates. ``project`` adds a concrete UTC Period to each matched event and
    returns a UTC Timeline; unmatched events are excluded.
    """

    def __init__(self) -> None:
        with (Config().global_dir / "schedule.yaml").open() as f:
            raw: dict = yaml.safe_load(f)
        self._data: dict[str, tuple[date, date]] = {
            key: (entry["start"], entry["end"])
            for key, entry in raw.items()
            if isinstance(entry, dict) and "start" in entry and "end" in entry
        }

    def get(self, key: str) -> tuple[date, date] | None:
        return self._data.get(key)

    def __contains__(self, key: object) -> bool:
        return key in self._data

    def project(self, timeline: Timeline) -> Timeline:
        """Return a new UTC Timeline containing only events present in this schedule.

        Each matched event retains its existing periods and gains a concrete UTC
        Period at ``_LAUNCH_HOUR``:00 on the scheduled start date, spanning to
        the same hour on the end date.
        """
        utc_timeline = Timeline(timezone.utc)
        for event in timeline:
            scheduled = self._data.get(str(event.key))
            if scheduled is None:
                continue
            start_date, end_date = scheduled
            utc_start = datetime(
                start_date.year, start_date.month, start_date.day,
                _LAUNCH_HOUR, tzinfo=timezone.utc,
            )
            utc_end = datetime(
                end_date.year, end_date.month, end_date.day,
                _LAUNCH_HOUR, tzinfo=timezone.utc,
            )
            utc_period = Period(utc_start, span=utc_end - utc_start)
            event.periods.append(utc_period)
            utc_timeline.append(event)
        return utc_timeline
