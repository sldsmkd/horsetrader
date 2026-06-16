from dataclasses import dataclass, field

from horsetrader.core import Period
from horsetrader.models.media import Image
from horsetrader.models.rewards import stamp_skill_test_rewards
from horsetrader.output._records import SkillTestRecord
from horsetrader.semantics import daitaku

from ._misc_banner import process_misc_banner
from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class SkillTest(WikiruEvent):
    """A Trainer Skills Test occurrence — recurring (~3×/year), rushable."""

    banner: Image | None = field(default=None, kw_only=True)
    _RECORD = SkillTestRecord

    def bake(self, period: Period) -> SkillTestRecord:
        return SkillTestRecord(
            **self._envelope(period),
            name=self.name,
            banner=str(self.banner.url) if self.banner else None,
        )


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
        self._assign_banner(skill_tests)
        stamp_skill_test_rewards(skill_tests)
        return skill_tests

    @staticmethod
    def _assign_banner(skill_tests: list[SkillTest]) -> None:
        image = process_misc_banner("trainers-skill-test.png")
        if image is None:
            return

        for skill_test in skill_tests:
            skill_test.banner = image
            skill_test.references.add(image.references)
