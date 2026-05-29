from datetime import date, datetime, timedelta

from horsetrader.core import JST, UTC, Period
from horsetrader.models.entities import Support, Trainee
from horsetrader.models.events import Anniversary, Banner, GoldenWeek, NewYear, Scenario, Story
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor

_ANCHOR_TYPES = (Anniversary, GoldenWeek, NewYear, Scenario)
_STORY_WINDOW = timedelta(days=7)


@matikanefukukitaru
class BannerPredictor(Predictor):
    """Predict EN banner release dates.

    Pass 1 (high confidence): if a JP banner co-released with a scenario,
    anniversary, or holiday, snap it to that event's EN date.

    Pass 2 (story promotion): if a story drops within a few days of the JP
    banner and contains every trainee and support featured on the banner,
    treat it as the banner's promotional tie-in and snap to the story's EN date.
    """

    def predict(self, timeline: Timeline) -> int:
        count = self._pass_anchors()
        count += self._pass_stories()
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
            if isinstance(event, Banner) and not any(p.tzinfo == UTC for p in event.periods):
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

    def _pass_stories(self) -> int:
        stories: list[tuple[datetime, datetime, set[str], set[str]]] = []
        for event in self._timeline:
            if isinstance(event, Story):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                en = next((p for p in event.periods if p.tzinfo == UTC), None)
                if jp and en:
                    trainee_keys = {str(t.key) for t in event.trainees}
                    support_keys = {str(s.key) for s in event.supports}
                    stories.append((jp.start, en.start, trainee_keys, support_keys))
        if not stories:
            return 0

        count = 0
        for event in self._timeline:
            if not isinstance(event, Banner) or not event.contents:
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if jp is None:
                continue
            banner_trainees = {str(c.key) for c in event.contents if isinstance(c, Trainee)}
            banner_supports = {str(c.key) for c in event.contents if isinstance(c, Support)}
            for story_jp, story_en, t_keys, s_keys in stories:
                if abs(story_jp - jp.start) > _STORY_WINDOW:
                    continue
                if banner_trainees <= t_keys and banner_supports <= s_keys:
                    event.periods.append(Period(
                        start=datetime(story_en.year, story_en.month, story_en.day, 22, tzinfo=UTC),
                        span=jp.span,
                        predicted=True,
                    ))
                    count += 1
                    break
        return count
