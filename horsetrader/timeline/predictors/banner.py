import bisect
from datetime import date, datetime

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger
from horsetrader.models.events import Banner, Holiday, Scenario, Story
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor, nearest_weekday

logger = Logger.get(__name__)

_ANCHOR_TYPES = (Holiday, Scenario)


@matikanefukukitaru
class BannerPredictor(Predictor):
    """Predict EN banner release dates.

    Pass 1 (high confidence): if a JP banner co-released with a scenario,
    anniversary, or holiday, snap it to that event's EN date.

    Pass 2 (story promotion): if a story drops within a few days of the JP
    banner and contains every trainee and support featured on the banner,
    treat it as the banner's promotional tie-in and snap to the story's EN date.

    Pass 3 (spacing interpolation): the remainder are marketing-driven orphans
    with no anchor co-release and no story cast match. Bisect each between its
    two nearest scheduled banners (confirmed or predicted by passes 1/2) and
    place it at the matching JP-time fraction of the EN window — i.e. carry the
    JP spacing across, scaled into UTC.

    Pass 4 (tail extrapolation): the most recent JP banners have no later
    scheduled banner to bracket against, so pass 3 can't reach them. Carry the
    last scheduled banner forward along the JST→UTC acceleration slope — a
    straight linear extrapolation that needs no right anchor.
    """

    def predict(self, timeline: Timeline) -> int:
        count = self._pass_anchors()
        count += self._pass_stories()
        count += self._pass_interpolate()
        count += self._pass_extrapolate()
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
        # Each story knows whether it promotes a banner (`Story.promotes` — the
        # cast-subset-within-window correlation force, shared with `Selectors`).
        stories = [
            event for event in self._timeline
            if isinstance(event, Story)
            and any(p.tzinfo == UTC for p in event.periods)
        ]
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
            for story in stories:
                if not story.promotes(event):
                    continue
                story_en = next(p for p in story.periods if p.tzinfo == UTC)
                event.periods.append(Period(
                    start=datetime(story_en.start.year, story_en.start.month, story_en.start.day, 22, tzinfo=UTC),
                    span=jp.span,
                    predicted=True,
                ))
                count += 1
                break
        return count

    def _pass_interpolate(self) -> int:
        # Banners sit on a JST timeline, so JP order is just chronological. For
        # each orphan, find the nearest scheduled banner on either side and place
        # it at the same fraction of the EN window it occupies in the JP window —
        # the JP spacing carried across, scaled into UTC. Weekday-snapped to the
        # confirmed EN distribution; the same drift caveat as StoryPredictor's
        # interpolation pass applies.
        valid_weekdays = {d for d, n in self.weekday(Banner, UTC).items() if n > 0}
        if not valid_weekdays:
            return 0

        banners = sorted(
            (
                (e, jp)
                for e in self._timeline
                if isinstance(e, Banner)
                and (jp := next((p for p in e.periods if p.tzinfo == JST), None))
            ),
            key=lambda pair: pair[1].start,
        )
        scheduled: list[tuple[int, datetime, datetime]] = []
        for i, (banner, jp) in enumerate(banners):
            en = next((p for p in banner.periods if p.tzinfo == UTC), None)
            if en is not None:
                scheduled.append((i, jp.start, en.start))
        scheduled_idx = [s[0] for s in scheduled]

        count = 0
        for i, (banner, jp) in enumerate(banners):
            if any(p.tzinfo == UTC for p in banner.periods):
                continue
            pos = bisect.bisect_left(scheduled_idx, i)
            if pos == 0 or pos == len(scheduled):
                continue
            _, left_jp, left_en = scheduled[pos - 1]
            _, right_jp, right_en = scheduled[pos]
            jp_span = (right_jp - left_jp).total_seconds()
            if jp_span <= 0:
                continue
            # Bisect assumes EN preserves JP order — if it ever re-orders past a
            # neighbour, interpolation runs backwards. Skip + warn, don't stamp.
            # Equal endpoints are a tie, not a re-ordering (both neighbours map to
            # the same EN day — common far out where predictions collapse); that
            # interpolates cleanly to the shared date below, so only strict
            # backwards is the anomaly.
            if right_en < left_en:
                logger.warning(
                    "Banner %s: EN bracket not monotonic (left=%s, right=%s); skipping",
                    banner.key, left_en, right_en,
                )
                continue
            frac = (jp.start - left_jp).total_seconds() / jp_span
            rough = left_en + (right_en - left_en) * frac
            snapped = nearest_weekday(rough, valid_weekdays)
            banner.periods.append(Period(
                start=datetime(snapped.year, snapped.month, snapped.day, 22, tzinfo=UTC),
                span=jp.span,
                predicted=True,
            ))
            count += 1
        return count

    def _pass_extrapolate(self) -> int:
        # Tail orphans sit past the last scheduled banner — no right neighbour for
        # pass 3 to bracket against. Anchor on the latest scheduled banner and
        # project each forward along the JST->UTC acceleration slope: a straight
        # line off the last known point. Lower confidence than bracketed
        # interpolation, but the tail has no better signal to lean on.
        valid_weekdays = {d for d, n in self.weekday(Banner, UTC).items() if n > 0}
        if not valid_weekdays:
            return 0
        try:
            slope = self._timeline.acceleration(JST, UTC)
        except ValueError:
            return 0

        scheduled: list[tuple[datetime, datetime]] = []
        for event in self._timeline:
            if not isinstance(event, Banner):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            en = next((p for p in event.periods if p.tzinfo == UTC), None)
            if jp and en:
                scheduled.append((jp.start, en.start))
        if not scheduled:
            return 0
        anchor_jp, anchor_en = max(scheduled)

        count = 0
        for event in self._timeline:
            if not isinstance(event, Banner) or any(p.tzinfo == UTC for p in event.periods):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            # Tail only — anything at or before the anchor is a pass-3 concern, not
            # an extrapolation. (None should remain, but guard rather than project
            # backwards off a later anchor.)
            if jp is None or jp.start <= anchor_jp:
                continue
            rough = anchor_en + slope * (jp.start - anchor_jp)
            snapped = nearest_weekday(rough, valid_weekdays)
            event.periods.append(Period(
                start=datetime(snapped.year, snapped.month, snapped.day, 22, tzinfo=UTC),
                span=jp.span,
                predicted=True,
            ))
            count += 1
        return count
