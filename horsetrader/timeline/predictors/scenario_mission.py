from horsetrader.core import JST, UTC, Period
from horsetrader.models.events import Scenario, ScenarioMission
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor


@matikanefukukitaru
class ScenarioMissionPredictor(Predictor):
    """Pin each scenario-launch celebration mission's EN window to its scenario.

    A `ScenarioMission` references its scenario by key (`scenario-NN`) and the
    scenario's EN date is placed upstream (verified, or by `ScenarioPredictor`).
    So the mission's EN window is an exact key lookup — take its day-offset from
    its scenario's JP launch and apply it to that scenario's EN launch, keeping
    the JP span. Same machinery as `AnniversaryMissionPredictor`; running off the
    confirmed scenario magnets beats letting these drop through the generic
    fallthrough, and each placed mission is one more anchor for the chain.

    Must run *after* `ScenarioPredictor`. A scenario with no EN date yet (most —
    EN trails JP by years) simply leaves its missions unpredicted for the
    fallthrough, exactly as before.
    """

    def predict(self, timeline: Timeline) -> int:
        # scenario key -> (JP point, EN point), only those with both
        scenarios: dict[str, tuple[Period, Period]] = {}
        for event in self._timeline:
            if isinstance(event, Scenario):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                en = next((p for p in event.periods if p.tzinfo == UTC), None)
                if jp and en:
                    scenarios[str(event.key)] = (jp, en)
        if not scenarios:
            return 0

        count = 0
        for event in self._timeline:
            if not isinstance(event, ScenarioMission):
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue  # already carries a confirmed/overlaid EN window
            ref = scenarios.get(str(event.scenario))
            if ref is None:
                continue  # the scenario has no EN date yet — leave for fallthrough
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
