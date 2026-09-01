from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from horsetrader.core import Periods, StableKey
from horsetrader.enums import SupportRarity, SupportType

from .banner import Banners, TraineeBanner


def _support(key: str, release: datetime):
    return SimpleNamespace(
        key=key,
        character=SimpleNamespace(key="char-silence-suzuka"),
        display=None,
        rarity=SupportRarity.SSR,
        release=SimpleNamespace(start=release),
        type=SupportType.SPEED,
    )


def test_support_rerun_excludes_main_story_welfare():
    pullable = _support(
        "support-30002-silence-suzuka",
        datetime(2021, 2, 24, tzinfo=timezone.utc),
    )
    welfare = _support(
        "support-30076-silence-suzuka",
        datetime(2021, 12, 22, tzinfo=timezone.utc),
    )
    supports = SimpleNamespace(values=lambda: [pullable, welfare])
    static = SimpleNamespace(
        main_story=lambda: [
            {
                "rewards": ["support-30076-silence-suzuka"],
            }
        ]
    )

    with (
        patch("horsetrader.models.events.banner.Supports", return_value=supports),
        patch("horsetrader.models.events.banner.Static", return_value=static),
    ):
        indexes = Banners._build_support_indexes()

    resolved = Banners._resolve_support_pickup(
        {
            "name": "Silence Suzuka",
            "support_rarity": SupportRarity.SSR,
            "support_type": SupportType.SPEED,
        },
        datetime(2022, 8, 19, tzinfo=timezone.utc),
        "banner-30115",
        indexes,
    )

    assert resolved is not None
    assert str(resolved.key) == "support-30002-silence-suzuka"


def test_documented_jp_only_banner_is_not_predictable():
    banner = TraineeBanner(key=StableKey("banner-30130"), periods=Periods())
    static = SimpleNamespace(
        banner_period=lambda key: None,
        event_flags=lambda key: {"predictable": False},
    )

    with patch("horsetrader.models.events.banner.Static", return_value=static):
        enricher = next(iter(Banners._enrichers(None)))
        enricher(banner)

    assert not banner.predictable
