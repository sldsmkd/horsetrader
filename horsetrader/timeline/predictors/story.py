import bisect
from datetime import date, datetime

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger
from horsetrader.models.events import Anchor, Scenario, Story
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor, nearest_weekday

logger = Logger.get(__name__)

_ANCHOR_TYPES = (Anchor, Scenario)


@matikanefukukitaru
class StoryPredictor(Predictor):
    """Predict EN story release dates in two passes.

    Pass 1 (high confidence): if a JP story co-released with a scenario,
    anniversary, or holiday, snap it to that event's EN date.

    Pass 2 (interpolation): bisect stories by ordinal between scheduled neighbours
    and place each unscheduled story at the matching JP-time fraction of the EN
    window, snapped to the weekday distribution of confirmed EN stories.
    """

    def predict(self, timeline: Timeline) -> int:
        count = self._pass_anchors()
        count += self._pass_interpolate()
        return count

    def _pass_anchors(self) -> int:
        anchor_en_by_jp_date: dict[date, Period] = {}
        for event in self._timeline:
            if isinstance(event, _ANCHOR_TYPES):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                en = next((p for p in event.periods if p.tzinfo == UTC), None)
                if jp and en:
                    anchor_en_by_jp_date[jp.start.date()] = en

        count = 0
        for event in self._timeline:
            if isinstance(event, Story) and not any(p.tzinfo == UTC for p in event.periods):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                if jp is not None:
                    anchor = anchor_en_by_jp_date.get(jp.start.date())
                    if anchor is not None:
                        event.periods.append(Period(
                            start=datetime(anchor.start.year, anchor.start.month, anchor.start.day, 22, tzinfo=UTC),
                            span=jp.span,
                            predicted=True,
                        ))
                        count += 1
        return count

    def _pass_interpolate(self) -> int:
        # TODO(mati): nearest_weekday can drift the snap past the bracket. Vibes,
        # not statistics — acceptable today. A future "vibe-weight" helper
        # (weekday * day-of-week confidence * proximity, returning a probability
        # distribution over candidate days) would replace this hard set.
        valid_weekdays = {d for d, n in self.weekday(Story, UTC).items() if n > 0}
        if not valid_weekdays:
            return 0

        stories = sorted(
            (e for e in self._timeline if isinstance(e, Story)),
            key=lambda s: str(s.key),
        )
        scheduled: list[tuple[int, datetime, datetime]] = []
        for i, story in enumerate(stories):
            jp = next((p for p in story.periods if p.tzinfo == JST), None)
            en = next((p for p in story.periods if p.tzinfo == UTC), None)
            if jp and en:
                scheduled.append((i, jp.start, en.start))
        scheduled_idx = [s[0] for s in scheduled]

        count = 0
        for i, story in enumerate(stories):
            if any(p.tzinfo == UTC for p in story.periods):
                continue
            jp = next((p for p in story.periods if p.tzinfo == JST), None)
            if jp is None:
                continue
            pos = bisect.bisect_left(scheduled_idx, i)
            if pos == 0 or pos == len(scheduled):
                continue
            _, left_jp, left_en = scheduled[pos - 1]
            _, right_jp, right_en = scheduled[pos]
            jp_span = (right_jp - left_jp).total_seconds()
            if jp_span <= 0:
                continue
            # Bisect assumes EN follows JP ordinal — if EN ever re-orders past
            # a neighbour, interpolation produces a backwards date. Skip + warn
            # rather than stamp garbage.
            if right_en <= left_en:
                logger.warning(
                    "Story %s: EN bracket not monotonic (left=%s, right=%s); skipping",
                    story.key, left_en, right_en,
                )
                continue
            frac = (jp.start - left_jp).total_seconds() / jp_span
            rough = left_en + (right_en - left_en) * frac
            snapped = nearest_weekday(rough, valid_weekdays)
            story.periods.append(Period(
                start=datetime(snapped.year, snapped.month, snapped.day, 22, tzinfo=UTC),
                span=jp.span,
                predicted=True,
            ))
            count += 1
        return count
