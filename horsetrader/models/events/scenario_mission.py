from dataclasses import dataclass, field

from horsetrader.core import Period, SingletonMeta, StableKey
from horsetrader.info import Logger
from horsetrader.output._records import ScenarioMissionRecord
from horsetrader.semantics import daitaku

from .anniversary import classify_anniversary_mission
from .events import Events
from .mission import Mission, jp_start, scraped_missions
from .scenario import classify_scenario_mission

logger = Logger.get(__name__)


@daitaku
@dataclass
class ScenarioMission(Mission):
    """A mission celebrating a new scenario's launch.

    Structurally a `Mission` (the same scraped shape — title, periods, the
    scraped reward subset), but a distinct *class* that references *up* to its
    `scenario-NN`. It is one-shot launch income (a "公開記念ミッション" run that
    fires once when a scenario drops), not the recurring grind catalogue — so it
    is split out of `Mission` the same way anniversary missions are, the link
    pointing up so the `Scenario` never reaches for it (no greedy cross-collection
    mutation). The launch *date* is the link, since these missions don't name
    their scenario (see `classify_scenario_mission`).
    """

    scenario: StableKey = field(kw_only=True)

    def bake(self, period: Period) -> ScenarioMissionRecord:
        return ScenarioMissionRecord(
            **self._envelope(period),
            name=self.title,
            scenario=self.scenario,
        )


@daitaku
class ScenarioMissions(Events[ScenarioMission], metaclass=SingletonMeta):
    """The scenario-launch celebration missions — a second special-mission class
    split out of `Missions`. Partitions the one scraped mission substrate by
    `classify_scenario_mission` (after the anniversary partition, so the three
    are disjoint) and tags each with its `scenario-NN` key."""

    def search(self, query) -> list[ScenarioMission]:
        return super().search(query)

    def _validate_item(self, item: ScenarioMission) -> None:
        if not item.periods:
            logger.warning("Scenario mission %s has no period", item.key)

    def _fetch_primary(self) -> list[ScenarioMission]:
        missions: list[ScenarioMission] = []
        for r in scraped_missions():
            if classify_anniversary_mission(r["title"].jp) is not None:
                continue
            scenario = classify_scenario_mission(r["title"].jp, jp_start(r))
            if scenario is None:
                continue
            mission = ScenarioMission(
                key=r["key"],
                periods=r["periods"],
                title=r["title"],
                rewards=r["rewards"],
                references=r["references"],
                scenario=scenario,
            )
            if r["flags"]:
                mission.apply_flags(r["flags"])
            missions.append(mission)
        return missions
