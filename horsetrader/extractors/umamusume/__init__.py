from collections.abc import Sequence

from horsetrader.core import SingletonMeta
from horsetrader.semantics import transcend

from .skills import UmamusumeSkills


@transcend
class Umamusume(metaclass=SingletonMeta):
    """Facade for data extracted from the installed Global game client."""

    def __init__(self):
        self._skills = UmamusumeSkills()

    def skills(self) -> Sequence[dict]:
        """Extract lossless skill records with the Global EN text overlay."""
        return self._skills.skills()
