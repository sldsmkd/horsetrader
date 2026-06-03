import re
from datetime import timedelta

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger
from horsetrader.models.events import Anchor, Mission
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor

logger = Logger.get(__name__)

# An anniversary mission names itself one ("X.5th Anniversary", "Half
# Anniversary", JP 周年/アニバ). Name is the *validation*; the date picks which
# anniversary. Anniversaries are 6 months apart and the celebration missions sit
# within ~2-3 weeks of the beat, so the nearest anchor is unambiguous — bound it
# generously to reject a stray match.
_ANNI_NAME = re.compile(r"anniversary|周年|アニバ", re.IGNORECASE)
_MAX_ANCHOR_DISTANCE = timedelta(days=60)


def _is_anniversary(event) -> bool:
    return isinstance(event, Anchor) and getattr(event, "kind", None) == "anniversary"


def _anni_named(mission: Mission) -> bool:
    title = mission.title
    if title is None:
        return False
    for attr in ("display", "jp", "en"):
        try:
            text = getattr(title, attr)
        except Exception:
            continue  # `.en` raises when unset; skip the slots that aren't there
        if text and _ANNI_NAME.search(text):
            return True
    return False


@matikanefukukitaru
class MissionPredictor(Predictor):
    """Anchor anniversary missions to their anniversary's EN date.

    Missions are a campaign-tied flat catalogue with no EN-specific signal, so
    they ride the generic fallthrough (accepted as uncategorised) — *except* the
    anniversary celebration mission sets (the half-/full-anniversary Part 1/2/3).
    Those are pinned to the anniversary beat, which IS placed accurately (curated
    or `AnniversaryPredictor`). So for a mission whose name marks it as an
    anniversary one, anchor its EN window to the nearest anniversary anchor,
    preserving the mission's JP offset from that anchor (Part 1 leads, Part 3
    trails). Matched by date (nearest anniversary, bounded), validated by name —
    a non-anniversary mission near the date is left for the fallthrough.
    """

    def predict(self, timeline: Timeline) -> int:
        anchors = [
            (jp, en)
            for event in self._timeline
            if _is_anniversary(event)
            for jp in [next((p for p in event.periods if p.tzinfo == JST), None)]
            for en in [next((p for p in event.periods if p.tzinfo == UTC), None)]
            if jp and en
        ]
        if not anchors:
            return 0

        count = 0
        for event in self._timeline:
            if not isinstance(event, Mission):
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue
            if not _anni_named(event):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if jp is None:
                continue
            anchor_jp, anchor_en = min(
                anchors, key=lambda a: abs((a[0].start - jp.start).days)
            )
            if abs((anchor_jp.start - jp.start).days) > _MAX_ANCHOR_DISTANCE.days:
                continue  # no anniversary near enough — leave for the fallthrough
            offset = jp.start.date() - anchor_jp.start.date()
            event.periods.append(
                Period(start=anchor_en.start + offset, span=jp.span, predicted=True)
            )
            count += 1
        return count
