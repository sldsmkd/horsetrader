import re
from dataclasses import dataclass

from horsetrader.core import Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.output._records import AnniversaryRecord
from horsetrader.semantics import daitaku

from .event import Event, Invisible
from .events import Events

logger = Logger.get(__name__)

# Ordinal suffix for the whole-year labels (1st, 2nd, 3rd, …). Halves read as
# "N.5th"; the launch half (0.5) is the in-game "Half Anniversary".
_ORDINALS = {1: "st", 2: "nd", 3: "rd"}

# An anniversary celebration mission names itself: the JP title embeds the Latin
# anniversary token ("Half" / "1st" / "1.5th" / … + "Anniversary") AND a `第N弾`
# part marker. The token gives the exact version (no date-nearest guessing); the
# marker gives the wave (1 = countdown before the date, 2 = on the date, 3 =
# after). `記念` ("commemorative") is NOT a marker — the weekly G1 race missions
# and the scenario-launch missions share it but lack the Latin token.
_ANNI_TOKEN = re.compile(r"(?:(\d+(?:\.5)?)(?:st|nd|rd|th)|(Half))\s*Anniversary", re.I)
_PART = re.compile(r"第(\d+)弾")


def classify_anniversary_mission(title_jp: str) -> tuple[StableKey, int] | None:
    """Classify a mission by its JP title.

    Returns `(anniversary_key, part)` when the title marks it an anniversary
    celebration mission, else `None`. This is the shared partition both
    `Missions` and `AnniversaryMissions` apply to the one scraped mission
    substrate — neither collection owns the other's records, and the link points
    *up* from the mission to its `anniversary-N_M` anchor.

    A title bearing the anniversary token but no `第N弾` marker is logged and
    left unclassified (it degrades to a normal `Mission` rather than being lost).
    """
    token = _ANNI_TOKEN.search(title_jp)
    if token is None:
        return None
    version = (
        "0.5" if token.group(2)
        else token.group(1) if "." in token.group(1)
        else f"{token.group(1)}.0"
    )
    part = _PART.search(title_jp)
    if part is None:
        logger.warning("Anniversary-named mission %r has no 第N弾 part marker", title_jp)
        return None
    return StableKey(f"anniversary-{version.replace('.', '_')}"), int(part.group(1))


@daitaku
@dataclass
class Anniversary(Invisible, Event):
    """A game anniversary launch — a scenario-shaped below-line point event.

    Anniversaries used to be the synthetic empty `Anchor` peg (`anchor-anni-*`)
    that lead-ins and missions hung off. They are really a *launch* in their own
    right, the same shape as a `Scenario`: a dated point carrying verified JP +
    EN starts and a display name. (They historically coincided with scenario
    releases — a new scenario dropped each anniversary — but the cadences have
    since diverged, so they are kept as distinct records.)

    The half/full version lives in the key (`anniversary-1_5`) and is surfaced
    as `version` / `name` rather than the runtime class. Dates are ground truth;
    the reward haul is a separate layer carried elsewhere.
    """

    def match(self, query: str) -> bool:
        return super().match(query) or query.lower() in self.name.lower()

    @property
    def version(self) -> str:
        """The numeric version parsed from the key: `anniversary-1_5` → "1.5"."""
        return self.key.removeprefix("anniversary-").replace("_", ".")

    @property
    def name(self) -> str:
        """The display label derived from the version.

        `0.5` → "Half Anniversary"; whole years take an ordinal ("1st
        Anniversary"); other halves read as "N.5th Anniversary".
        """
        if self.version == "0.5":
            return "Half Anniversary"
        whole, _, frac = self.version.partition(".")
        if frac == "0":
            n = int(whole)
            return f"{n}{_ORDINALS.get(n, 'th')} Anniversary"
        return f"{self.version}th Anniversary"

    def bake(self, period: Period) -> AnniversaryRecord:
        # A scenario-style record: the shared envelope (dates, predicted flag,
        # key, any rewards) plus the derived display `name`.
        return AnniversaryRecord(**self._envelope(period), name=self.name)


@daitaku
class Anniversaries(Events[Anniversary], metaclass=SingletonMeta):
    """Every game anniversary launch (half and full), keyed `anniversary-N_M`.

    A point-launch collection alongside `Scenarios` — the curated source carries
    verified JP starts (all) and EN starts (only those that have reached
    Global)."""

    def search(self, query) -> list[Anniversary]:
        return super().search(query)

    def _validate_item(self, item: Anniversary) -> None:
        if not item.periods:
            logger.warning("Anniversary %s has no periods", item.key)

    def _fetch_primary(self) -> list[Anniversary]:
        anniversaries: list[Anniversary] = []
        for record in Static().anniversaries():
            periods = Periods([record["period"]])
            references = References([record["source"]])
            en = record.get("en")
            if en is not None:
                periods.append(en["period"])
                references.add(en["source"])

            anniversary = Anniversary(
                key=StableKey(str(record["key"])),
                periods=periods,
                references=references,
            )
            if (visible := record.get("visible")) is not None:
                anniversary.apply_flags({"visible": visible})
            anniversaries.append(anniversary)
        return anniversaries
