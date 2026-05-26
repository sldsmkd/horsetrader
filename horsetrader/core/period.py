from datetime import datetime, timedelta

from horsetrader.semantics import daitaku


@daitaku
class Period:
    def __init__(self, start: datetime, span: timedelta | None = None):
        """A date period representing a specific date and an optional span of days.
        Args:
            start (datetime): The specific date for the period. Time components will be ignored.
            span (timedelta | None): The span of days for the period. Defaults to None, which is treated as 0 days for calculations.
        span is truncated to whole days, so any time component will be ignored. For example, a span of 1 day means the period includes the date itself and the next day.
        """
        if not isinstance(start, datetime):
            raise ValueError("start must be a datetime object")
        if span is not None and not isinstance(span, timedelta):
            raise ValueError("span must be a timedelta object or None")
        if span is None:
            span = timedelta(days=0)
        span = timedelta(days=span.days)
        self._date = start.replace(hour=0, minute=0, second=0, microsecond=0)
        self._span = span

    @property
    def start(self) -> datetime:
        return self._date

    @property
    def end(self) -> datetime:
        return self._date + self._span

    @property
    def span(self) -> timedelta:
        return self._span

    def isoformat(self) -> str:
        return self._date.date().isoformat()

    def __eq__(self, other):
        if not isinstance(other, Period):
            return NotImplemented
        return self.start == other.start and self.span == other.span

    def __hash__(self):
        return hash((self._date, self._span))

    def __lt__(self, other):
        if not isinstance(other, Period):
            return NotImplemented
        return self.start < other.start

    def __repr__(self):
        return f"Period(start={self._date}, span={self._span})"

    def __str__(self):
        return self.__repr__()
