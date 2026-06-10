import re
from datetime import timedelta

from horsetrader.core import JST, UTC, Period
from horsetrader.extractors.static import store
from horsetrader.models.events import Anniversary, AnniversaryMission
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor

_DURATION = re.compile(r"P(\d+)D")


def shape_anniversary_mission_windows(timeline: Timeline) -> int:
    """Override each anniversary mission's EN window span with its curated
    `en.duration` (the login-bonus window in `anniversaries.yaml`).

    EN-only, and applied AFTER prediction so it covers both the predicted EN
    periods (Mati just placed) and the confirmed/scraped ones uniformly: the
    scraped/predicted span is the generous shared claim window, which would show
    every part closing on one far deadline. `en.duration` replaces it with the
    real login cadence so the parts flow and no reward reads as crediting a month
    late. The JP period is left untouched (substrate). Returns the count reshaped.
    """
    count = 0
    for event in timeline:
        if not isinstance(event, AnniversaryMission):
            continue
        en = store.overlay(str(event.key), "en")
        match = _DURATION.fullmatch((en or {}).get("duration", ""))
        if match is None:
            continue
        span = timedelta(days=int(match.group(1)))
        for i, period in enumerate(event.periods):
            if period.tzinfo == UTC:
                event.periods[i] = Period(
                    start=period.start, span=span, predicted=period.predicted
                )
                count += 1
    return count


@matikanefukukitaru
class AnniversaryMissionPredictor(Predictor):
    """Pin each anniversary celebration mission's EN window to its anniversary.

    An `AnniversaryMission` references its anniversary by key (`anniversary-N_M`)
    and the anniversary's EN date is placed accurately upstream (verified, or by
    `AnniversaryPredictor`). So each mission's EN window is an exact key lookup —
    no name-regex, no nearest-anchor search: take the mission's day-offset from
    its anniversary's JP date and apply it to that anniversary's EN date, keeping
    the JP span.

    The window the span carries is NOT the generous claim window — it's the
    fixed-length login-bonus window, baked onto the mission from the curated
    `anniversaries.yaml` (span = login length, ending on the last login day). So
    the parts flow into one another on their real cadence (countdown → main →
    mid) instead of piling onto the shared claim deadline; this predictor just
    re-anchors that already-correct span onto the EN start.
    """

    def predict(self, timeline: Timeline) -> int:
        # anniversary key -> (JP point, EN point), only those with both
        anni: dict[str, tuple[Period, Period]] = {}
        for event in self._timeline:
            if isinstance(event, Anniversary):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                en = next((p for p in event.periods if p.tzinfo == UTC), None)
                if jp and en:
                    anni[str(event.key)] = (jp, en)
        if not anni:
            return 0

        count = 0
        for event in self._timeline:
            if not isinstance(event, AnniversaryMission):
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue  # already carries a confirmed/overlaid EN window
            ref = anni.get(str(event.anniversary))
            if ref is None:
                continue  # the anniversary has no EN date yet — leave unpredicted
            anchor_jp, anchor_en = ref
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if jp is None:
                continue
            offset = jp.start.date() - anchor_jp.start.date()
            event.periods.append(
                Period(start=anchor_en.start + offset, span=jp.span, predicted=True)
            )
            count += 1
        return count
