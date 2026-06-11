import bisect
from datetime import date, datetime, timedelta

from horsetrader.core import JST, UTC, Period
from horsetrader.models.events import Anchor, Anniversary, Scenario, Story
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor, nearest_weekday

_ANCHOR_TYPES = (Anchor, Scenario)


@matikanefukukitaru
class StoryPredictor(Predictor):
    """Predict EN story release dates by hanging each story off the anniversary poles.

    Anniversaries are the trustworthy fixed magnets on the timeline (every ~6
    months, and self-consistent with the global acceleration), so they — not the
    neighbouring stories — are what a floating story is placed relative to. Three
    cases, by where a story sits relative to those poles:

    1. **On a pole** (co-release — shares a JP drop-date with a scenario,
       anniversary, or holiday): flip & lock onto that anchor's EN date. The
       field is strong enough to override spacing, so the story cohabits the
       anchor (e.g. 1.0's Trackblazer shipping with the 1st Anniversary).

    2. **Between two poles** (the hammock): place at the JP-time fraction of the
       way from the left pole to the right pole, scaled across the two poles' EN
       dates — the JP spacing carried into UTC. A small repulsion keeps it off an
       already-occupied day; then snap to the confirmed EN weekday distribution.

    3. **Past the last pole** (the tail — no right tree to hang from): fall back
       to the global JST->UTC acceleration off the last pole, with the same
       repulsion + snap. (A story before the *first* pole is launch-era and
       already carries confirmed EN data, so it never reaches prediction.)
    """

    def predict(self, timeline: Timeline) -> int:
        count = self._pass_anchors()
        count += self._pass_hammock()
        count += self._pass_tail()
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

    def _pass_hammock(self) -> int:
        poles = self._anni_poles()
        if len(poles) < 2:
            return 0
        valid_weekdays = {d for d, n in self.weekday(Story, UTC).items() if n > 0}
        if not valid_weekdays:
            return 0

        pole_jp = [p[0] for p in poles]
        occupied = self._occupied_en()
        count = 0
        for story, jp in self._unscheduled():
            # Bracket on the surrounding anniversary poles, not neighbouring
            # stories: the left pole is the latest anni at/before the story, the
            # right pole the earliest anni after it. No left pole (i == 0) is
            # launch-era; no right pole (i == len) is the tail — left for _pass_tail.
            i = bisect.bisect_right(pole_jp, jp.start)
            if i == 0 or i == len(poles):
                continue
            left_jp, left_en = poles[i - 1]
            right_jp, right_en = poles[i]
            frac = (jp.start - left_jp).total_seconds() / (right_jp - left_jp).total_seconds()
            rough = left_en + (right_en - left_en) * frac
            placed = self._snap_repel(rough, valid_weekdays, occupied)
            story.periods.append(Period(start=placed, span=jp.span, predicted=True))
            occupied.add(placed.date())
            count += 1
        return count

    def _pass_tail(self) -> int:
        poles = self._anni_poles()
        if not poles:
            return 0
        try:
            slope = self._timeline.acceleration(JST, UTC)
        except ValueError:
            return 0
        valid_weekdays = {d for d, n in self.weekday(Story, UTC).items() if n > 0}
        if not valid_weekdays:
            return 0

        last_jp, last_en = poles[-1]
        occupied = self._occupied_en()
        count = 0
        for story, jp in self._unscheduled():
            # Only the tail — anything at or before the last pole was the hammock's
            # job (and is already placed). Project straight off the last pole along
            # the global acceleration slope.
            if jp.start <= last_jp:
                continue
            rough = last_en + slope * (jp.start - last_jp)
            placed = self._snap_repel(rough, valid_weekdays, occupied)
            story.periods.append(Period(start=placed, span=jp.span, predicted=True))
            occupied.add(placed.date())
            count += 1
        return count

    def _anni_poles(self) -> list[tuple[datetime, datetime]]:
        poles: list[tuple[datetime, datetime]] = []
        for event in self._timeline:
            if isinstance(event, Anniversary):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                en = next((p for p in event.periods if p.tzinfo == UTC), None)
                if jp and en:
                    poles.append((jp.start, en.start))
        poles.sort()
        return poles

    def _unscheduled(self) -> list[tuple[Story, Period]]:
        out: list[tuple[Story, Period]] = []
        for event in self._timeline:
            if isinstance(event, Story) and not any(p.tzinfo == UTC for p in event.periods):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                if jp is not None:
                    out.append((event, jp))
        out.sort(key=lambda pair: pair[1].start)
        return out

    def _occupied_en(self) -> set[date]:
        occupied: set[date] = set()
        for event in self._timeline:
            if isinstance(event, (Story, Anniversary)):
                en = next((p for p in event.periods if p.tzinfo == UTC), None)
                if en is not None:
                    occupied.add(en.start.date())
        return occupied

    def _snap_repel(self, rough: datetime, valid_weekdays: set[int], occupied: set[date]) -> datetime:
        # Snap to the confirmed EN weekday distribution, then apply a small
        # repulsion: don't stack on a day already taken by another story or an
        # anniversary — step forward to the next free valid weekday. First cut is
        # a hard same-day exclusion; a future vibe-weight (weekday * proximity
        # confidence over candidate days) would soften it. TODO(mati).
        snapped = nearest_weekday(rough, valid_weekdays)
        for _ in range(8):
            if snapped.date() not in occupied:
                break
            snapped = nearest_weekday(snapped + timedelta(days=1), valid_weekdays)
        return datetime(snapped.year, snapped.month, snapped.day, 22, tzinfo=UTC)
