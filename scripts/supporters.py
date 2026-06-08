#!/usr/bin/env python3
"""Upsert a supporter into ``skeleton/json/supporters.json``.

The supporters file is a public seed (it rsyncs into ``static/json/`` and ships
with the site), so it must never contain a readable account ID. Each entry is
keyed by a **one-way hash of the account ID** and maps to the supporter's
username:

    { "<sha256-hex of the 12 account-id digits>": "<username>", ... }

The hash recipe is the etl<->site contract for this file: lowercase hex
``SHA-256`` over the ASCII digits-only form of the ID (dashes/spaces stripped),
exactly as the trainer-card field normalizes it. The client can recompute the
same hash from a locally-entered ID and look it up — without us ever publishing
the ID itself. This is screenshot/casual-leak protection, not real secrecy: a
12-digit keyspace is brute-forceable, so the file hides IDs from a glance, not
from a determined attacker (see docs — Trainer ID privacy stance).

Usage:
    python scripts/supporters.py <account-id> <username>

``<account-id>`` may be entered grouped (``540 903 147 493`` /
``540-903-147-493``) or bare; non-digits are stripped. Existing keys are
overwritten, new keys inserted. Output JSON is sorted for stable diffs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path


DEFAULT_FILE = Path("skeleton/json/supporters.json")
ID_DIGITS = 12


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("account_id", help="Account ID; grouping (spaces/dashes) is ignored, must be 12 digits.")
    parser.add_argument("username", help="Display name to store against the hashed ID.")
    parser.add_argument("--file", type=Path, default=DEFAULT_FILE, help=f"Supporters JSON file (default {DEFAULT_FILE}).")
    return parser.parse_args()


def normalize_account_id(raw: str) -> str:
    """Reduce an entered ID to its bare digits, matching the trainer-card field."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) != ID_DIGITS:
        raise ValueError(f"account id must be {ID_DIGITS} digits, got {len(digits)} from {raw!r}")
    return digits


def hash_account_id(digits: str) -> str:
    """Lowercase hex SHA-256 of the digit string — the client-reproducible key."""
    return hashlib.sha256(digits.encode("ascii")).hexdigest()


def load_supporters(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not all(isinstance(v, str) for v in data.values()):
        raise ValueError(f"{path} is not a flat hash->username object")
    return data


def write_supporters(path: Path, supporters: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(supporters, indent=2, sort_keys=True, ensure_ascii=False)
    path.write_text(text + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()

    username = args.username.strip()
    if not username:
        print("username must not be empty", file=sys.stderr)
        return 2

    try:
        key = hash_account_id(normalize_account_id(args.account_id))
        supporters = load_supporters(args.file)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 2

    action = "updated" if key in supporters else "inserted"
    supporters[key] = username
    write_supporters(args.file, supporters)

    print(f"{action} {username} ({len(supporters)} supporters in {args.file})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
