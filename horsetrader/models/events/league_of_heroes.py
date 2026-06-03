from dataclasses import dataclass

from horsetrader.output._records import LeagueOfHeroesRecord
from horsetrader.semantics import daitaku

from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class LeagueOfHeroes(WikiruEvent):
    """A League of Heroes occurrence — recurring quarterly PvP (it displaces a
    Champions Meeting slot; Feb/May/Aug/Nov from 2025). Scraped from wikiru
    (Gametora has no surface for it). Rushable.

    **Rewards HELD:** PvP with *graded* rewards — the plan is to ship the full
    tier→reward map and let the player choose their target tier (the Henry
    Handsome / prototype approach; the ETL owns the values, the client owns the
    strategy). Left unstamped pending that tiered-reward type. Getting the type
    in already solves timeline density for the client, with or without rewards.
    """

    _RECORD = LeagueOfHeroesRecord


@daitaku
class LeaguesOfHeroes(WikiruEvents[LeagueOfHeroes]):
    _HEADING = "リーグオブヒーローズ"
    _KEY_PREFIX = "leagueofheroes"
    # Provisional EN label until an EN occurrence ships.
    _EN_NAME = "League of Heroes"
    _MODEL = LeagueOfHeroes

    def search(self, query) -> list[LeagueOfHeroes]:
        return super().search(query)

    def _fetch_primary(self) -> list[LeagueOfHeroes]:
        # Rewards HELD: PvP graded payout → tier-map reward type (TODO), see
        # class docstring. The type alone adds timeline density.
        return self._build_events()
