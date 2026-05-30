from dataclasses import dataclass

from horsetrader.core import Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.rewards import rewards_from_baked
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)

# The whitelist of launch flavours, keyed by the stable-key body prefix (after
# the shared `anchor-` namespace). Order doesn't matter — the prefixes are
# mutually exclusive. Adding a flavour is a one-line edit here.
_KIND_BY_PREFIX = {
    "new-year-": "new-year",
    "golden-week-": "golden-week",
    "anni-": "anniversary",
}


@daitaku
@dataclass
class Anchor(Event):
    """A span-0 calendar launch that anchored events hang their spans off.

    New Year, Golden Week and anniversary launches were once distinct `Event`
    subclasses, but once their lead-ins / extensions moved to `AnchoredEvent`s
    (and Golden Week's themed name with them), nothing distinguished them at the
    model level: each is just a dated point carrying at most a curated login
    bonus. They collapse into this one type. The *kind* still matters to the EN
    predictors (New Year, Golden Week and anniversaries each predict on their
    own cadence), so it is carried by the stable key (`anchor-<kind>-…`) and
    read back via `kind` rather than the runtime class.
    """

    def __post_init__(self) -> None:
        # Fail loud at load: an anchor key that doesn't resolve to a whitelisted
        # flavour is a curation error (a typo'd prefix, a missing `anchor-`),
        # not something to limp past — every consumer below trusts `kind`.
        self.kind  # noqa: B018 — property access validates and raises

    @property
    def kind(self) -> str:
        """The launch flavour, parsed from the `anchor-…` key prefix.

        `anchor-new-year-2024` → "new-year", `anchor-golden-week-2024` →
        "golden-week", `anchor-anni-3_0` → "anniversary". Predictors filter on
        this where they once filtered on the concrete subclass.
        """
        body = self.key.removeprefix("anchor-")
        for prefix, kind in _KIND_BY_PREFIX.items():
            if body.startswith(prefix):
                return kind
        raise ValueError(
            f"Anchor key {self.key!r} resolves to no known kind; expected an "
            f"`anchor-` key with a whitelisted prefix ({', '.join(_KIND_BY_PREFIX)})"
        )

    def match(self, query: str) -> bool:
        return super().match(query)

    def bake(self, period: Period) -> dict:
        # Anchors are calendar points: no contents/art, just a date and any
        # curated rewards (the login-bonus generator), all of which the base
        # envelope already carries. All flavours (new year / golden week /
        # anniversary) collapse to one `type: "anchor"` — the client splits
        # them by key prefix, the same way `kind` does here.
        return super().bake(period)


@daitaku
class Anchors(Events[Anchor], metaclass=SingletonMeta):
    """Every base anchor — holidays (New Year / Golden Week) and anniversaries —
    in one collection. They share a shape (a dated point + optional rewards) and
    a role (a launch other events pin to), so they load side by side from their
    two curated sources."""

    def search(self, query) -> list[Anchor]:
        return super().search(query)

    def _validate_item(self, item: Anchor) -> None:
        if not item.periods:
            logger.warning("Anchor %s has no periods", item.key)

    def _fetch_primary(self) -> list[Anchor]:
        anchors: list[Anchor] = []
        anchors.extend(self._load(Static().holidays()))
        anchors.extend(self._load(Static().anniversaries()))
        return anchors

    @staticmethod
    def _load(records: list[dict]) -> list[Anchor]:
        anchors: list[Anchor] = []
        for record in records:
            periods = Periods([record["period"]])
            references = References([record["source"]])
            en = record.get("en")
            if en is not None:
                periods.append(en["period"])
                references.add(en["source"])

            # Login-bonus carats and the like are curated in the YAML (these
            # land only on anchors, never inferred), and the bonus is identical
            # across regions — so it's a shared field, not per-locale.
            raw_rewards = record.get("rewards")
            rewards = rewards_from_baked(raw_rewards) if raw_rewards else None

            anchors.append(
                Anchor(
                    key=StableKey(str(record["key"])),
                    periods=periods,
                    references=references,
                    rewards=rewards,
                )
            )
        return anchors
