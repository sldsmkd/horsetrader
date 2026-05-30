from datetime import datetime, timedelta
from statistics import mean

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger
from horsetrader.models.events import ChampionsMeeting
from horsetrader.semantics import matikanefukukitaru

from ..datemapper import DateMapper
from ..timeline import Timeline
from .base import Predictor

logger = Logger.get(__name__)

_DEFAULT_EN_SPAN = timedelta(days=10)


@matikanefukukitaru
class ChampionsMeetingPredictor(Predictor):
    """Predict EN Champions Meeting windows — anchored on the FINAL day.

    A CM is two different spans depending on the source (see docs/domain.md):
    Gametora records only competitive play, so the JP scrape is always exactly
    a 6-day *competition* window; the EN release is the full *availability*
    window (usually 10 days) that adds the lead-in on the front. So the generic
    fallthrough is wrong on both counts — it carries `jp.span` across (the fixed
    6 days, not ~10) and maps the JP *opening* day.

    The competition **final** is precomputed and immune to meta shifts, while
    the opening drifts: Cygames avoids dropping meta-changing banners during the
    competitive phase (the Oguri Cap rule), so registration/qualifier timing
    flexes but the final is fixed. We therefore anchor on the final — map JP
    final-day → EN final-day through a `DateMapper` built from confirmed CM
    pairs, then rebuild the EN availability window *backwards* from that final
    using the typical confirmed EN span. Final-to-final also sidesteps the
    asymmetric front-padding (EN's window includes registration days the JP
    scrape omits) for free.
    """

    def predict(self, timeline: Timeline) -> int:
        confirmed: list[tuple[Period, Period]] = []
        for event in self._timeline:
            if not isinstance(event, ChampionsMeeting):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            en = next((p for p in event.periods if p.tzinfo == UTC), None)
            if jp and en:
                confirmed.append((jp, en))

        # Need at least two confirmed finals for the DateMapper to interpolate
        # the JST→UTC warp; with fewer, leave CMs for the fallthrough.
        if len(confirmed) < 2:
            return 0

        mapper = DateMapper(JST, UTC)
        for jp, en in confirmed:
            mapper.add(jp.end, en.end)
        en_span = timedelta(
            days=round(mean((en.end - en.start).days for _, en in confirmed))
        )

        count = 0
        for event in self._timeline:
            if not isinstance(event, ChampionsMeeting):
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if jp is None:
                continue
            final_day = mapper.predict(jp.end, UTC)
            # EN CMs close (and finals land) at 22:00 UTC, the canonical Global
            # content instant; the window opens en_span earlier.
            end = datetime(final_day.year, final_day.month, final_day.day, 22, tzinfo=UTC)
            event.periods.append(
                Period(start=end - en_span, span=en_span, predicted=True)
            )
            count += 1
        return count
