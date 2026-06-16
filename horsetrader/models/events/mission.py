import functools
from dataclasses import dataclass, field
from datetime import datetime

from ethicrawl import ResourceList, Url

from horsetrader.core import Config, JST, Japlish, Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.static import Static, store
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.models.rewards import Rewards, reward_for_gametora_icon
from horsetrader.output._records import MissionRecord
from horsetrader.semantics import daitaku
from horsetrader.services import Translate

from .anniversary import classify_anniversary_mission
from .event import Event
from .events import Events
from .scenario import classify_scenario_mission

logger = Logger.get(__name__)


def _has_en(title: Japlish) -> bool:
    """Whether a title already carries an English slot (`.en` raises when unset)."""
    try:
        title.en
        return True
    except ValueError:
        return False


def jp_start(record: dict) -> datetime:
    """The JST launch instant of a scraped-mission record — the substrate period
    every scrape carries (the EN overlay is added later). Used by the partition
    to date-match scenario-launch celebration missions."""
    return next(p for p in record["periods"] if p.tzinfo == JST).start


def _resolve_rewards(reward_items: list[tuple[str, int]], key: str) -> Rewards | None:
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


def _process_images(records: list[dict]) -> dict[str, Image | None]:
    outdir = Config().static / "img" / "missions"
    requests: ResourceList[ImageRequest] = ResourceList()
    for record in records:
        if thumb_url := record.get("thumb_url"):
            requests.append(
                ImageRequest(
                    url=Url(thumb_url),
                    outfile=outdir / f"{record['key']}.webp",
                )
            )
    if not requests:
        return {}
    return CurrenChan().process(requests)


@functools.cache
def scraped_missions() -> list[dict]:
    """The shared scraped mission substrate — one built record per Gametora
    mission (JP + EN overlay, resolved rewards, curated flags).

    Both `Missions` and `AnniversaryMissions` partition this by
    `classify_anniversary_mission`; neither owns the other's records, and the
    heavy per-record build (the EN join + reward resolution) happens once.
    """
    en_by_key = {r["key"]: r for r in Gametora().missions_en()}
    records = list(Gametora().missions())
    images = _process_images(records)

    built: list[dict] = []
    for record in records:
        key = record["key"]
        en = en_by_key.get(key)
        thumb_url = record.get("thumb_url")
        image = images.get(thumb_url) if thumb_url else None

        title = Japlish(record["title"], encoding="jp")
        if en is not None:
            try:
                title.en = en["title"]
            except ValueError as exc:
                logger.warning("Bad EN title for %s: %s", key, exc)
        if not _has_en(title):
            # No Global EN (no row, or a bad one) — let Shuttle project one from
            # the race domain. Recognises only the GⅠ-celebration family and
            # no-ops otherwise, so this is a pure fallback: it never overwrites a
            # real scraped EN, and the JP-only fall-through stays the gap signal.
            title = Translate().mission(title)

        periods = Periods([record["period"]])
        references = References(record.get("references", []))
        if en is not None:
            periods.append(en["period"])
            references.add(en.get("references", []))
        if image is not None:
            references.add(image.references)

        flags = Static().event_flags(str(key))
        if flags:
            references.add(store.source())

        built.append({
            "key": StableKey(key),
            "title": title,
            "periods": periods,
            "references": references,
            "rewards": _resolve_rewards(record.get("reward_items", []), key),
            "image": image,
            "flags": flags,
        })
    return built


@daitaku
@dataclass
class Mission(Event):
    """A limited-mission campaign — a dated window granting a fixed reward set.

    The JP `Period` + reward subset come from the Gametora JA history (the
    substrate); an EN `Period` and EN title are overlaid when the campaign has
    reached Global, joined on the shared logo-id key. `title` is JP-by-default
    with the EN slot filled when known.

    Not `Rushable`: a mission set is farmed across its window, there's no
    post-at-start choice. Rewards are the scraped carat-economy subset (the long
    tail — manie, friend points — is dropped by the `reward_for_gametora_icon`
    allowlist, same as story events), not a heuristic.
    """

    title: Japlish | None = None
    image: Image | None = field(default=None, kw_only=True)

    def match(self, query: str) -> bool:
        return super().match(query) or (
            self.title is not None and self.title.match(query)
        )

    def bake(self, period: Period) -> MissionRecord:
        return MissionRecord(
            **self._envelope(period),
            name=self.title,
            image=str(self.image.url) if self.image else None,
        )


@daitaku
class Missions(Events[Mission], metaclass=SingletonMeta):
    def search(self, query) -> list[Mission]:
        return super().search(query)

    def _validate_item(self, item: Mission) -> None:
        if not item.periods:
            logger.warning("Mission %s has no period", item.key)

    def _fetch_primary(self) -> list[Mission]:
        # The chore-mission catalogue: every scraped mission that is neither an
        # anniversary celebration mission nor a scenario-launch celebration
        # mission. Both are split out to their own collections off the shared
        # substrate; this side is the complement.
        missions: list[Mission] = []
        for r in scraped_missions():
            if classify_anniversary_mission(r["title"].jp) is not None:
                continue
            if classify_scenario_mission(r["title"].jp, jp_start(r)) is not None:
                continue
            mission = Mission(
                key=r["key"],
                periods=r["periods"],
                title=r["title"],
                rewards=r["rewards"],
                references=r["references"],
                image=r["image"],
            )
            if r["flags"]:
                mission.apply_flags(r["flags"])
            missions.append(mission)
        return missions
