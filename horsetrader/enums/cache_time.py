from datetime import timedelta
from enum import Enum

# Cache aggressively as the data doesn't change much and we dont want to unduly strain source sites with frequent re-fetching.
# We can manually purge items that need refetching


class CacheTime(Enum):
    INDEX = timedelta(
        days=1
    )  # Use for pages that list multiple items, e.g. character index or trainee index.
    LEAF = timedelta(
        days=28
    )  # Use for pages that list a single item, e.g. character detail page. Longer TTL since these are less likely to change and more expensive to fetch.
    BINARY = timedelta(
        days=365 * 40000
    )  # Effectively infinite TTL for binary resources like images, which are immutable and can be re-fetched if missing from cache.
    SENTINEL = timedelta(
        days=7
    )  # TTL for negative-cache sentinels (e.g. 404s). Re-checks after this period in case the resource has since appeared.
