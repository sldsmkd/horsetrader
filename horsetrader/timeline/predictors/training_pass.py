from datetime import datetime, timedelta

from horsetrader.core import JST, UTC, Period, Periods, StableKey
from horsetrader.models.events import Anniversary, TrainingPass
from horsetrader.models.rewards import FreeCarats, Rewards, SupportTicket, TraineeTicket
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor

# The Training Pass holds a steady ~monthly cadence wherever it runs; we model the
# placeholder series as a flat 30-day roll.
_CADENCE = timedelta(days=30)

# The pass debuted at the 3rd anniversary (JP 3.0). The series is anchored on that
# launch in each region.
_ANCHOR_KEY = "anniversary-3_0"

# FREE-TRACK rewards stamped on every minted occurrence — unconditional income
# everyone gets. The premium boost is NOT here: it bakes to
# `reward_maps["training-pass"]["premium"]` and is applied client-side by the
# toggle (frontend, deferred).
def _free_track() -> Rewards:
    return Rewards([
        FreeCarats(500),
        TraineeTicket(2),
        SupportTicket(2),
    ])


@matikanefukukitaru
class TrainingPassPredictor(Predictor):
    """Mint the Training Pass battle-pass series — created, not scheduled.

    The Training Pass has no scrape and no JP per-occurrence truth (Global hasn't
    shipped it; the JP/Korea durations are variable and uncurated). So unlike every
    other predictor — which *appends a UTC period to an event a collection already
    produced* — this one **creates the events itself**, last in the chain, once the
    real timeline is fully scheduled and projected. It reads the 3rd-anniversary
    launch (`anniversary-3_0`, whose EN date the `AnniversaryPredictor` has already
    placed) and rolls 30-day windows forward to the timeline's right edge.

    Both periods are `predicted` and minted:
      - **EN/UTC** = `en(anniversary-3_0).start + n·30d`. This is a *flat* roll, not
        a JST→UTC projection: the pass keeps its monthly cadence regardless of the
        regional acceleration (Korea confirms), so projecting JP buys nothing.
      - **JST** = `jp(anniversary-3_0).start + n·30d`. A *plausible* JP date, invented
        purely to (a) satisfy the JST-locked `Timeline` invariant — every event must
        carry a period in the timeline's tz — and (b) read sanely as the JP origin
        of each window. It is **not** ground truth; that is why it is `predicted`
        (so it never pollutes `origin(JST)` / `acceleration`, which only consider
        non-predicted periods).

    When Global ships real Training Passes they become curated, scraped occurrences
    that schedule the normal way; this minter then only fills beyond the last real
    one (the same "predict past the confirmed tail" stance the other predictors take).
    """

    def predict(self, timeline: Timeline) -> int:
        anchor = next(
            (
                e
                for e in self._timeline
                if isinstance(e, Anniversary) and e.key == _ANCHOR_KEY
            ),
            None,
        )
        if anchor is None:
            return 0
        jp = next((p for p in anchor.periods if p.tzinfo == JST), None)
        en = next((p for p in anchor.periods if p.tzinfo == UTC), None)
        # No 3rd anniversary, or its EN date isn't projected yet — nothing to anchor.
        if jp is None or en is None:
            return 0

        # Roll only to the timeline's existing right edge, so the minted series
        # covers the same span as the rest of the projected content and can't grow
        # unbounded. Snapshot it before we start appending our own UTC periods.
        horizon = max(
            (p.start for e in self._timeline for p in e.periods if p.tzinfo == UTC),
            default=en.start,
        )

        count = 0
        n = 0
        while True:
            en_start = en.start + n * _CADENCE
            if en_start > horizon:
                break
            jp_start = jp.start + n * _CADENCE
            event = TrainingPass(
                key=StableKey(f"training-pass-{n + 1:03d}"),
                periods=Periods([
                    Period(start=jp_start, span=_CADENCE, predicted=True),
                    Period(start=en_start, span=_CADENCE, predicted=True),
                ]),
                name="Training Pass",
                rewards=_free_track(),
            )
            self._timeline.append(event)
            count += 1
            n += 1
        return count
