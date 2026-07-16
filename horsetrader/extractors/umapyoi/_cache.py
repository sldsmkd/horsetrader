import json
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from horsetrader.transport import progressive_cache_time


def unix_json_cache_time(
    response: str | bytes,
    cached_at: datetime,
    fields: tuple[str, ...],
) -> timedelta:
    """Progressive TTL from the newest Unix timestamp in a JSON object.

    A malformed old cache entry gets a zero TTL so the caller refreshes it once;
    normal decoding then remains responsible for failing loudly on bad fresh data.
    """
    try:
        payload = json.loads(response)
        timestamps = [
            datetime.fromtimestamp(payload[field], tz=timezone.utc)
            for field in fields
            if isinstance(payload.get(field), (int, float))
        ]
    except (json.JSONDecodeError, TypeError, ValueError, OverflowError):
        return timedelta(0)
    if not timestamps:
        return timedelta(0)
    return progressive_cache_time(max(timestamps), cached_at)


def http_date_json_cache_time(
    response: str | bytes,
    cached_at: datetime,
    fields: tuple[str, ...],
) -> timedelta:
    """Progressive TTL from the newest RFC/HTTP date in a JSON object."""
    try:
        payload = json.loads(response)
        timestamps = [
            parsedate_to_datetime(payload[field])
            for field in fields
            if isinstance(payload.get(field), str) and payload[field].strip()
        ]
    except (json.JSONDecodeError, TypeError, ValueError, OverflowError):
        return timedelta(0)
    if not timestamps or any(value.tzinfo is None for value in timestamps):
        return timedelta(0)
    return progressive_cache_time(max(timestamps), cached_at)
