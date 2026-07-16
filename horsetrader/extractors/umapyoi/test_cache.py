import json
from datetime import datetime, timedelta, timezone

from ._cache import http_date_json_cache_time, unix_json_cache_time


def test_unix_json_cache_time_uses_newest_timestamp():
    cached_at = datetime(2026, 1, 11, tzinfo=timezone.utc)
    response = json.dumps(
        {
            "post_at": int(datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp()),
            "update_at": int(datetime(2026, 1, 6, tzinfo=timezone.utc).timestamp()),
        }
    )

    assert unix_json_cache_time(
        response,
        cached_at,
        ("update_at", "post_at"),
    ) == timedelta(days=5)


def test_http_date_json_cache_time_uses_newest_timestamp():
    cached_at = datetime(2026, 1, 11, tzinfo=timezone.utc)
    response = json.dumps(
        {
            "date_gmt": "Thu, 01 Jan 2026 00:00:00 GMT",
            "modified_gmt": "Tue, 06 Jan 2026 00:00:00 GMT",
        }
    )

    assert http_date_json_cache_time(
        response,
        cached_at,
        ("modified_gmt", "date_gmt"),
    ) == timedelta(days=5)


def test_json_cache_time_rejects_malformed_cached_content():
    cached_at = datetime(2026, 1, 11, tzinfo=timezone.utc)

    assert unix_json_cache_time("not json", cached_at, ("start_date",)) == timedelta(0)
    assert http_date_json_cache_time("{}", cached_at, ("modified_gmt",)) == timedelta(0)
