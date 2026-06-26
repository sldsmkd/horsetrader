from dataclasses import dataclass, field

from ethicrawl import ResourceList, Url
from msgspec import UNSET

from horsetrader.core import Config, Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.models.rewards import (
    FreeCarats,
    Rewards,
    SequenceReward,
    rewards_from_baked,
)
from horsetrader.output._records import HolidayRecord
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)

_COUNTDOWN_SUFFIX = "-countdown"


@daitaku
@dataclass
class Holiday(Event):
    """A seasonal holiday launch — a scenario-shaped below-line event.

    Golden Week and New Year used to be the synthetic span-0 `Anchor`
    (`anchor-*`) that lead-ins hung off. Each is really a *launch* in its own
    right, the same shape as a `Scenario` or `Anniversary`: a curated JP (+ EN
    once shipped) window carrying a themed display `name` and any login rewards.
    Unlike the old anchor it has a real span — these run for a window, not a
    single instant.

    The flavour (`golden-week`, `new-year`, `marketing-starhorse-4`, …) lives in
    the key and is surfaced as `kind` for cadence/presentation logic, rather
    than the runtime class. New Year's pre-roll countdown is a sibling `Holiday`
    keyed `…-countdown` (the curated replacement for the old `before-new-year`
    anchored event); `is_countdown` marks it so the predictor derives its EN
    from the parent rather than placing it on the holiday cadence.
    """

    name: str = field(kw_only=True)
    banner: Image | None = field(default=None, kw_only=True)

    @property
    def is_countdown(self) -> bool:
        """A pre-roll lead-in (`…-countdown`) hanging off a main holiday launch."""
        return self.key.endswith(_COUNTDOWN_SUFFIX)

    @property
    def kind(self) -> str:
        """The holiday flavour, parsed from the `holiday-<kind>-<year>` key.

        `holiday-golden-week-2026` → "golden-week"; the countdown sibling
        `holiday-new-year-2026-countdown` → "new-year" (same flavour as its
        parent); `holiday-marketing-starhorse-4` → "marketing-starhorse-4".
        The `-countdown` suffix and a trailing four-digit year are dropped.
        """
        body = self.key.removeprefix("holiday-").removesuffix(_COUNTDOWN_SUFFIX)
        head, _, tail = body.rpartition("-")
        if head and tail.isdigit() and len(tail) == 4:
            return head
        return body

    def match(self, query: str) -> bool:
        return super().match(query) or query.lower() in self.name.lower()

    def bake(self, period: Period) -> HolidayRecord:
        # A scenario-style record: the shared envelope (dates, predicted flag,
        # key, any rewards) plus the curated display `name` and optional banner.
        return HolidayRecord(
            **self._envelope(period),
            name=self.name,
            banner=str(self.banner.url) if self.banner else UNSET,
        )


@daitaku
class Holidays(Events[Holiday], metaclass=SingletonMeta):
    """Every seasonal holiday launch, keyed `holiday-<kind>-<year>` or
    `holiday-marketing-<slug>` (+ New Year `…-countdown` lead-ins).

    A point-launch collection alongside `Scenarios` / `Anniversaries`. The
    curated source carries verified JP starts (all) and EN starts (only those
    that have reached Global). Golden Week and marketing tie-in rewards are
    baked-shape blocks, often a flat login `generator`; New Year rewards are
    per-day `login` sequences (a `SequenceReward`, the gift folded into day-0),
    the same shape as the anniversary logins."""

    def search(self, query) -> list[Holiday]:
        return super().search(query)

    def _validate_item(self, item: Holiday) -> None:
        if not item.periods:
            logger.warning("Holiday %s has no periods", item.key)

    def _fetch_primary(self) -> list[Holiday]:
        holidays: list[Holiday] = []
        baked_reward_records = Static().golden_weeks() + Static().marketing_holidays()
        banner_images = self._process_banners(baked_reward_records)
        for record in baked_reward_records:
            raw = record.get("rewards")
            holidays.append(
                self._build(
                    record,
                    rewards_from_baked(raw) if raw else None,
                    banner_images.get(record.get("banner_url")),
                )
            )
        for record in Static().new_years():
            login = record["login"]
            rewards = Rewards([SequenceReward(reward_type=FreeCarats, sequence=tuple(login))])
            holidays.append(self._build(record, rewards))
        return holidays

    @staticmethod
    def _build(
        record: dict,
        rewards: Rewards | None,
        banner: Image | None = None,
    ) -> Holiday:
        periods = Periods([record["period"]])
        references = References([record["source"]])
        en = record.get("en")
        if en is not None:
            periods.append(en["period"])
            references.add(en["source"])
        if banner is not None:
            references.add(banner.references)

        holiday = Holiday(
            key=StableKey(str(record["key"])),
            periods=periods,
            references=references,
            name=record["name"],
            rewards=rewards,
            banner=banner,
        )
        if (visible := record.get("visible")) is not None:
            holiday.apply_flags({"visible": visible})
        return holiday

    @staticmethod
    def _process_banners(records: list[dict]) -> dict[str, Image | None]:
        outdir = Config().static / "img" / "holidays"
        requests: ResourceList[ImageRequest] = ResourceList()
        for record in records:
            if banner_url := record.get("banner_url"):
                requests.append(
                    ImageRequest(
                        url=Url(banner_url),
                        outfile=outdir / f"{record['key']}-banner.webp",
                    )
                )
        if not requests:
            return {}
        return CurrenChan().process(requests)
