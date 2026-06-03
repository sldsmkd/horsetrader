from dataclasses import dataclass

from horsetrader.core import Japlish, Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.gametora import Gametora
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.rewards import Rewards, reward_for_gametora_icon
from horsetrader.output._records import MissionRecord
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)


@daitaku
@dataclass
class Mission(Event):
    """A limited-mission campaign — a dated window granting a fixed reward set.

    The JP `Period` + reward subset come from the Gametora JA history (the
    substrate); an EN `Period` and EN title are overlaid when the campaign has
    reached Global, joined on the shared logo-id key. `title` is JP-by-default
    with the EN slot filled when known.

    Not a `RushableEvent`: a mission set is farmed across its window, there's no
    post-at-start choice. Rewards are the scraped carat-economy subset (the long
    tail — manie, friend points — is dropped by the `reward_for_gametora_icon`
    allowlist, same as story events), not a heuristic.
    """

    title: Japlish | None = None

    def match(self, query: str) -> bool:
        return super().match(query) or (
            self.title is not None and self.title.match(query)
        )

    def bake(self, period: Period) -> MissionRecord:
        return MissionRecord(
            **self._envelope(period),
            name=self.title.display if self.title else None,
        )


@daitaku
class Missions(Events[Mission], metaclass=SingletonMeta):
    def search(self, query) -> list[Mission]:
        return super().search(query)

    def _validate_item(self, item: Mission) -> None:
        if not item.periods:
            logger.warning("Mission %s has no period", item.key)

    def _fetch_primary(self) -> list[Mission]:
        en_by_key = {r["key"]: r for r in Gametora().missions_en()}

        missions: list[Mission] = []
        for record in Gametora().missions():
            key = record["key"]
            en = en_by_key.get(key)

            title = Japlish(record["title"], encoding="jp")
            if en is not None:
                try:
                    title.en = en["title"]
                except ValueError as exc:
                    logger.warning("Bad EN title for %s: %s", key, exc)

            periods = Periods([record["period"]])
            references = References(record.get("references", []))
            if en is not None:
                periods.append(en["period"])
                references.add(en.get("references", []))

            missions.append(
                Mission(
                    key=StableKey(key),
                    periods=periods,
                    title=title,
                    rewards=self._resolve_rewards(record.get("reward_items", []), key),
                    references=references,
                )
            )
        return missions

    @staticmethod
    def _resolve_rewards(
        reward_items: list[tuple[str, int]], key: str
    ) -> Rewards | None:
        # One Reward per scraped row; the bake mapper sums same-keyed entries.
        # Allowlist by design: scraped icons without a typed `Reward` subclass
        # (manie, friend points, …) drop at debug — same stance as story events.
        rewards = Rewards()
        for icon_id, amount in reward_items:
            cls = reward_for_gametora_icon(icon_id)
            if cls is None:
                logger.debug("Unmapped reward icon %s in %s (x%d)", icon_id, key, amount)
                continue
            rewards.append(cls(amount=amount))
        return rewards or None
