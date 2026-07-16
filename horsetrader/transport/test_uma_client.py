from datetime import datetime, timedelta, timezone

import pytest

from horsetrader.enums import CacheTime

from .uma_client import _cache_entry_is_fresh, progressive_cache_time
from .uma_client_cache import CacheEntry


def test_progressive_cache_time_uses_source_age_when_cached():
    changed_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    assert progressive_cache_time(
        changed_at,
        changed_at + timedelta(days=1),
    ) == timedelta(days=1)
    assert progressive_cache_time(
        changed_at,
        changed_at + timedelta(days=7),
    ) == timedelta(days=7)
    assert progressive_cache_time(
        changed_at,
        changed_at + timedelta(days=365),
    ) == timedelta(days=365)


def test_progressive_cache_time_has_one_day_prerelease_floor():
    release = datetime(2026, 8, 1, tzinfo=timezone.utc)
    cached_at = datetime(2026, 7, 1, tzinfo=timezone.utc)

    assert progressive_cache_time(release, cached_at) == timedelta(days=1)


def test_progressive_cache_time_requires_aware_datetimes():
    with pytest.raises(ValueError, match="timezone-aware"):
        progressive_cache_time(
            datetime(2026, 1, 1),
            datetime(2026, 1, 2, tzinfo=timezone.utc),
        )


def test_dynamic_cache_time_controls_entry_freshness():
    now = datetime(2026, 1, 10, tzinfo=timezone.utc)
    entry = CacheEntry(
        content="cached",
        modified_at=now - timedelta(days=3),
    )

    assert _cache_entry_is_fresh(
        entry,
        lambda content, cached_at: timedelta(days=4),
        is_binary=False,
        skip_refresh=False,
        now=now,
    )
    assert not _cache_entry_is_fresh(
        entry,
        lambda content, cached_at: timedelta(days=2),
        is_binary=False,
        skip_refresh=False,
        now=now,
    )
    assert not _cache_entry_is_fresh(
        CacheEntry(content="malformed", modified_at=now),
        lambda content, cached_at: timedelta(0),
        is_binary=False,
        skip_refresh=False,
        now=now,
    )


def test_fixed_and_default_cache_times_remain_available():
    now = datetime(2026, 1, 10, tzinfo=timezone.utc)
    entry = CacheEntry(
        content="cached",
        modified_at=now - timedelta(days=2),
    )

    assert _cache_entry_is_fresh(
        entry,
        CacheTime.LEAF,
        is_binary=False,
        skip_refresh=False,
        now=now,
    )
    assert not _cache_entry_is_fresh(
        entry,
        None,
        is_binary=False,
        skip_refresh=False,
        now=now,
    )
    assert _cache_entry_is_fresh(
        entry,
        None,
        is_binary=False,
        skip_refresh=True,
        now=now,
    )
