from pathlib import Path

from horsetrader.core import Period, SingletonMeta
from horsetrader.semantics import transcend

from . import aliases as _aliases
from . import anniversaries as _anniversaries
from . import banners as _banners
from . import champions_meetings as _champions_meetings
from . import christmas as _christmas
from . import golden_week as _golden_week
from . import main_story as _main_story
from . import marketing as _marketing
from . import new_year as _new_year
from . import legend_races as _legend_races
from . import misc as _misc
from . import reward_maps as _reward_maps
from . import reward_structures as _reward_structures
from . import scenarios as _scenarios
from . import showtimes as _showtimes
from . import stories as _stories
from . import translations as _translations


@transcend
class Static(metaclass=SingletonMeta):
    """Facade for static file data extraction.

    Returns raw record dicts and core primitives; entity construction is
    Digitan's responsibility (see [[project-transcend-digitan-boundary]]).
    """

    def search_aliases(self) -> dict[str, list[str]]:
        """Community search aliases as a ``target -> phrases`` map.

        Targets are stable keys (``char-`` folds onto every atom of that
        character; ``trainee-`` / ``support-`` apply to one card). The
        target→atom join and dangling-target check live in the bake.
        """
        return _aliases.load()

    def anniversaries(self) -> list[dict]:
        """Records from the consolidated anniversaries.yaml (JP + EN)."""
        return _anniversaries.load()

    def mission_translations(self) -> dict[str, str]:
        """Curated whole-string mission-title translations (``translate-mission-*``)
        as a ``jp -> en`` map — the Shuttle tokenizer's one-off vocabulary."""
        return _translations.missions()

    def race_translations(self) -> dict[str, str]:
        """Curated NAR/local race-name translations (``translate-race-*``) as a
        ``jp -> en`` map, for races whose `Race` entity has no `.en` yet."""
        return _translations.races()

    def scenarios(self) -> list[dict]:
        """Records from the consolidated scenarios.yaml (JP + EN).

        Each record has key, title_en, title_jp, art_url, period, source,
        and an 'en' key (dict | None) with the EN period, title, and source.
        """
        return _scenarios.load()

    def main_story(self) -> list[dict]:
        """Records from the curated main_story.yaml — the 10-chapter main-story
        campaign (JP + optional EN).

        Each record carries key, title_jp/title_en, period (span-0 JP launch),
        rewards (welfare card stable keys), carats (flattened story-clear total),
        banner (local filename | remote URL), source, and an 'en' key (dict | None)
        with the EN period + title once a chapter has reached Global. Daitaku builds
        the `MainStory` events.
        """
        return _main_story.load()

    def golden_weeks(self) -> list[dict]:
        """Golden Week launches (`holiday-golden-week-*`), consolidated JP + EN.

        Each record has key, name (themed title), period (JP, with an optional
        `duration` span), source, a 'rewards' key (baked-shape mapping | None),
        and an 'en' key (dict | None) with the EN period + source when shipped.
        """
        return _golden_week.load()

    def christmas_holidays(self) -> list[dict]:
        """Reward-bearing Christmas campaigns (`holiday-christmas-*`).

        Same holiday record shape as Star Horse: a required JP period, shared
        rewards and banner, and an optional confirmed EN overlay.
        """
        return _christmas.load()

    def marketing_holidays(self) -> list[dict]:
        """Marketing tie-in launches (`holiday-marketing-*`), consolidated JP + EN.

        Same record shape as Golden Week: key, name, JP period, source, optional
        baked-shape rewards, optional banner URL, and optional EN period + source.
        """
        return _marketing.load()

    def new_years(self) -> list[dict]:
        """New Year launches (`holiday-new-year-*`), consolidated JP + EN.

        Each year yields two records — the MAIN celebration and its COUNTDOWN
        lead-in (`<key>-countdown`). Each has key, name, period (JP window),
        a 'login' per-day sequence (the model builds the SequenceReward), an 'en'
        key (dict | None; countdown is always None — derived from the main), and
        source.
        """
        return _new_year.load()

    def story_banners(self) -> list[dict]:
        """Banner image records from static/img/stories/, sorted by ordinal.

        Each record has ``n`` (1-based ordinal) and ``banner_path`` (Path).
        """
        return _stories.load()

    def misc_image(self, name: str) -> Path | None:
        """Path to a curated misc image under config/img/misc/, or None."""
        return _misc.image(name)

    def event_flags(self, key: str) -> dict[str, bool]:
        """Curated optional event flags for ``key``.

        Flags are region-agnostic. ``visible`` and ``rushable`` are
        presence-encoded at bake time; ``predictable`` is model-only curation.
        Returning only authored booleans lets model defaults keep doing the
        right thing when a key has no static overlay.
        """
        fields = store.shared(str(key))
        label = f"{store.source()}: event {key!r}"
        return {
            name: value
            for name in ("visible", "rushable", "predictable")
            if (value := store.optional_bool(fields, name, label)) is not None
        }

    def banner_period(self, key: str) -> Period | None:
        """UTC Period for the EN banner with this key, or None if not in banners.yaml."""
        return _banners.load().get(key)

    def banner_rewards(self) -> dict[str, dict]:
        """Curated per-banner rewards (baked-shape mappings), keyed by
        ``banner-<id>``.

        The whole map (a banner without curated rewards is absent); the
        reward-key parse and the target→banner join are the `Banners`
        collection's.
        """
        return _banners.load_rewards()

    def cm_period(self, key: str) -> Period | None:
        """UTC Period for the EN Champions Meeting with this key, or None if not curated."""
        return _champions_meetings.load().get(key)

    def legend_race_period(self, key: str) -> Period | None:
        """UTC Period for the EN Legend Race with this key, or None if not curated."""
        return _legend_races.load().get(key)

    def showtime(self, key: str) -> dict | None:
        """EN overlay for the Showtime with this key, or None if not curated.

        The entry carries the EN ``period`` (UTC), the EN ``name``, and the
        region-agnostic ``rewards`` (baked-shape mapping | None) — the model
        converts the rewards and joins on the wikiru-scraped JP run.
        """
        return _showtimes.load().get(key)

    def reward_structures(self) -> dict[str, dict]:
        """Curated standing reward structures, keyed ``reward-structure-<slug>``.

        Each entry carries a region-agnostic ``rewards`` block (baked-shape
        mapping); Yayoi builds the `RewardStructure`s and Eishin bakes them to
        ``config.json``.
        """
        return _reward_structures.load()

    def reward_maps(self) -> dict[str, dict]:
        """Curated rank-graded reward maps, keyed ``reward-map-<slug>``.

        Each entry carries a ``tiers`` block (rank-label → baked-shape rewards);
        Yayoi builds a `RewardStructure` per tier into a `RewardMap`, and Eishin
        bakes them under ``reward_maps`` in ``config.json``.
        """
        return _reward_maps.load()

    def story_period(self, key: str) -> Period | None:
        """UTC Period for the EN story with this stable key, or None if not in stories.yaml."""
        entry = _stories.load_en().get(key)
        return entry["period"] if entry else None

    def story_name_override(self, key: str) -> str | None:
        """Maintainer-curated EN title for this story (fansub default, Cygames-official
        when shipped), or None if no override is recorded in stories.yaml.
        """
        entry = _stories.load_en().get(key)
        return entry["name"] if entry else None
