#!/usr/bin/env python3
"""Warm the Umapyoi news API cache.

Fetches the raw ``/api/v1/news`` index through ``Umapyoi().news()``, extracts
likely item ids from the decoded JSON, then fetches each ``/api/v1/news/{id}``
leaf through ``Umapyoi().news_item(id)``. The payload shape is still exploratory,
so this script is intentionally conservative and schema-light.

Usage:
    venv/bin/python scripts/warm_umapyoi_news.py
    venv/bin/python scripts/warm_umapyoi_news.py --limit 20
    venv/bin/python scripts/warm_umapyoi_news.py --ids 123 124 125
"""

from __future__ import annotations

import argparse
import sys
import time
from collections.abc import Iterable
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from horsetrader.extractors.umapyoi import Umapyoi


ITEM_CONTAINER_KEYS = (
    "data",
    "items",
    "news",
    "results",
    "records",
    "posts",
    "entries",
)
ID_KEYS = (
    "id",
    "news_id",
    "newsId",
    "web_id",
    "webId",
    "slug",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ids", nargs="+", help="Explicit news ids to warm instead of deriving ids from the index.")
    parser.add_argument("--id-key", help="Field name to read from each index item before trying the built-in guesses.")
    parser.add_argument("--limit", type=int, help="Only warm the first N ids.")
    parser.add_argument("--delay", type=float, default=0.0, help="Seconds to sleep between leaf fetches.")
    parser.add_argument("--dry-run", action="store_true", help="Fetch the index and print ids without fetching leaf pages.")
    parser.add_argument("--keep-going", action="store_true", help="Continue warming after a leaf fetch fails.")
    return parser.parse_args()


def _item_lists(payload: Any) -> Iterable[list[Any]]:
    if not isinstance(payload, dict):
        return

    for key in ITEM_CONTAINER_KEYS:
        value = payload.get(key)
        if isinstance(value, list):
            yield value
        elif isinstance(value, dict):
            for nested in _item_lists(value):
                yield nested

    values = list(payload.values())
    if values and all(isinstance(value, dict) for value in values):
        yield values


def _item_id(item: Any, id_key: str | None) -> str | None:
    if not isinstance(item, dict):
        return None

    keys = (id_key, *ID_KEYS) if id_key else ID_KEYS
    for key in keys:
        if not key:
            continue
        value = item.get(key)
        if isinstance(value, int):
            return str(value)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def ids_from_index(payload: Any, id_key: str | None = None) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()

    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, int):
                news_id = str(item)
            elif isinstance(item, str) and item.strip():
                news_id = item.strip()
            else:
                news_id = _item_id(item, id_key)
            if news_id and news_id not in seen:
                seen.add(news_id)
                ids.append(news_id)
        return ids

    if isinstance(payload, dict):
        root_id = _item_id(payload, id_key)
        if root_id:
            return [root_id]

    for items in _item_lists(payload):
        for item in items:
            news_id = _item_id(item, id_key)
            if news_id and news_id not in seen:
                seen.add(news_id)
                ids.append(news_id)
    return ids


def main() -> int:
    args = parse_args()
    if args.limit is not None and args.limit < 0:
        print("--limit must be >= 0", file=sys.stderr)
        return 2
    if args.delay < 0:
        print("--delay must be >= 0", file=sys.stderr)
        return 2

    source = Umapyoi()
    print("warming Umapyoi news index", file=sys.stderr)
    index = source.news()

    ids = [str(news_id).strip() for news_id in args.ids] if args.ids else ids_from_index(index, args.id_key)
    ids = [news_id for news_id in ids if news_id]
    if args.limit is not None:
        ids = ids[: args.limit]

    print(f"found {len(ids)} news id(s): {', '.join(ids[:12])}{' ...' if len(ids) > 12 else ''}", file=sys.stderr)
    if not ids:
        print("no ids found; rerun with --ids or --id-key after inspecting the cached index", file=sys.stderr)
        return 1
    if args.dry_run:
        return 0

    warmed = 0
    for index, news_id in enumerate(ids, start=1):
        try:
            print(f"[{index}/{len(ids)}] warming news {news_id}", file=sys.stderr)
            source.news_item(news_id)
            warmed += 1
        except Exception as exc:
            print(f"failed to warm news {news_id}: {exc}", file=sys.stderr)
            if not args.keep_going:
                return 1
        if index < len(ids) and args.delay:
            time.sleep(args.delay)

    print(f"warmed {warmed}/{len(ids)} news leaf page(s)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
