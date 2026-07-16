from datetime import datetime, timedelta, timezone

from .support import GametoraSupport
from .trainee import GametoraTrainee


def test_support_cache_time_comes_from_release_date():
    response = """
        <main>
          <div class="supports_infobox">
            <span>実装日 2026年1月1日</span>
          </div>
        </main>
    """
    cached_at = datetime(2026, 1, 8, 3, tzinfo=timezone.utc)

    assert GametoraSupport._cache_time(response, cached_at) == timedelta(days=7)


def test_trainee_cache_time_comes_from_release_date():
    response = """
        <main>
          <div class="characters_infobox_row">
            <span>実装日 2026年1月1日</span>
          </div>
        </main>
    """
    cached_at = datetime(2026, 1, 8, 3, tzinfo=timezone.utc)

    assert GametoraTrainee._cache_time(response, cached_at) == timedelta(days=7)


def test_gametora_cache_time_rejects_malformed_cached_content():
    cached_at = datetime(2026, 1, 8, tzinfo=timezone.utc)

    assert GametoraSupport._cache_time("<main></main>", cached_at) == timedelta(0)
    assert GametoraTrainee._cache_time("<main></main>", cached_at) == timedelta(0)
