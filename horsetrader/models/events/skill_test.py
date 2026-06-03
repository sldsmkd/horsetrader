from dataclasses import dataclass

from horsetrader.core import Period, Periods, SingletonMeta, StableKey
from horsetrader.info import Logger
from horsetrader.extractors.wikiru import Wikiru
from horsetrader.models.core import References
from horsetrader.models.rewards import stamp_skill_test_rewards
from horsetrader.output._records import SkillTestRecord
from horsetrader.semantics import daitaku

from .event import RushableEvent
from .events import Events

logger = Logger.get(__name__)

# All occurrences share the JP name (トレーナー技能試験); the EN label is uniform
# too, so it's a constant rather than a per-occurrence overlay. Provisional until
# an EN occurrence ships and confirms the official wording.
_EN_NAME = "Trainer Skills Test"


@daitaku
@dataclass
class SkillTest(RushableEvent):
    """A Trainer Skills Test occurrence — a recurring (~3×/year) competition window.

    JP runs are scraped from the wikiru event index; there is no EN overlay —
    the EN window is left to the `FallthroughPredictor` (a new event type with
    JP periods and no dedicated predictor is exactly what the fallthrough exists
    to map). Rewards are the fixed full-clear pattern stamped by
    `stamp_skill_test_rewards` (coin-exchange ceiling + the 7-challenge bonus).
    Rushable, like banners and Showtime.
    """

    name: str | None = None

    def match(self, query: str) -> bool:
        return super().match(query) or (
            self.name is not None and query.lower() in self.name.lower()
        )

    def bake(self, period: Period) -> SkillTestRecord:
        return SkillTestRecord(**self._envelope(period), name=self.name)


@daitaku
class SkillTests(Events[SkillTest], metaclass=SingletonMeta):
    def search(self, query) -> list[SkillTest]:
        return super().search(query)

    def _validate_item(self, item: SkillTest) -> None:
        if not item.periods:
            logger.warning("Skill test %s has no period", item.key)

    def _fetch_primary(self) -> list[SkillTest]:
        skill_tests = [
            SkillTest(
                key=StableKey(record["key"]),
                periods=Periods([record["period"]]),
                name=_EN_NAME,
                references=References(record.get("references", [])),
            )
            for record in Wikiru().skill_tests()
        ]
        stamp_skill_test_rewards(skill_tests)
        return skill_tests
