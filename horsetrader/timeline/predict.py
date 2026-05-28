from horsetrader.semantics import matikanefukukitaru

from .timeline import Timeline


@matikanefukukitaru
class Predict:
    """Extend a UTC Timeline with predicted EN periods for unscheduled JP events.

    Takes the full JST Timeline (all known JP events) and the confirmed UTC
    Timeline (events carrying concrete EN periods from enrichment), then
    adds ``predicted=True`` UTC Periods for any JP event not yet represented
    in the UTC Timeline.

    Currently a passthrough — returns ``utc_timeline`` unchanged. Implementation
    target: LOESS-style local weighted regression (K=20 Gaussian-kernel-weighted
    nearest confirmed JP↔EN pairs). Full spec in CLAUDE.md §4 "Prediction engine
    upgrade". Outlier rules (e.g. CM-overlap avoidance) go in a post-processing
    hook layered on top of the regression, per CLAUDE.md §4 "Prediction outlier
    rules".
    """

    def predict(self, jst_timeline: Timeline, utc_timeline: Timeline) -> Timeline:
        return utc_timeline
