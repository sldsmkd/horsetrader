from dataclasses import dataclass

from horsetrader.models.rewards import stamp_skill_test_rewards
from horsetrader.output._records import SkillTestRecord
from horsetrader.semantics import daitaku

from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class SkillTest(WikiruEvent):
    """A Trainer Skills Test occurrence — recurring (~3×/year), rushable."""

    _RECORD = SkillTestRecord


@daitaku
class SkillTests(WikiruEvents[SkillTest]):
    _HEADING = "トレーナー技能試験"
    _KEY_PREFIX = "skilltest"
    # Provisional EN label until an EN occurrence ships and confirms the wording.
    _EN_NAME = "Trainer Skills Test"
    _MODEL = SkillTest

    def search(self, query) -> list[SkillTest]:
        return super().search(query)

    def _fetch_primary(self) -> list[SkillTest]:
        skill_tests = self._build_events()
        stamp_skill_test_rewards(skill_tests)
        return skill_tests
