from dataclasses import dataclass

from horsetrader.core import Period
from horsetrader.output._records import TrainingPassRecord
from horsetrader.semantics import daitaku

from .event import Event


@daitaku
@dataclass
class TrainingPass(Event):
    """A Training Pass battle-pass window — a recurring, below-line availability event.

    The "Training Pass" is Cygames' battle-pass progression system (introduced JP
    at the 3.0 anniversary alongside the U.A.F. scenario): you accrue points by
    training, unlocking jewels / scout tickets / materials across two tracks — a
    free one everyone gets and a paid premium one that boosts it. Global hasn't
    shipped it yet, and the JP/Korea durations are variable and uncurated, so
    there is no scrape and no JP per-occurrence truth: Mati *mints* the series in
    the predict phase (see `TrainingPassPredictor`) as a 30-day rolling cadence
    off the 3rd anniversary, replaced by curated truth once Global delivers it.

    Carries only the FREE track in `rewards` (the shared envelope) — unconditional
    income everyone on the timeline sees. The premium track is the toggle-gated
    boost and lives in `reward_maps["training-pass"]["premium"]` (config.json),
    selected client-side; it is deliberately *not* modelled on the event. Not
    rushable: points farm across the window, there is no post-at-start choice.

    `name` is the constant EN display label; the ordinal lives in the stable key
    (`training-pass-NNN`).
    """

    name: str | None = None

    def match(self, query: str) -> bool:
        return super().match(query) or (
            self.name is not None and query.lower() in self.name.lower()
        )

    def bake(self, period: Period) -> TrainingPassRecord:
        return TrainingPassRecord(**self._envelope(period), name=self.name)
