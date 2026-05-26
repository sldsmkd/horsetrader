"""
jitter.py — Spread cache file mtimes across the last 30 days.

Run once after a bulk cache warm-up so that all files don't expire
simultaneously, amortising upstream requests over the normal monthly cycle.
"""

import os
import random
import time
from pathlib import Path

from horsetrader.core import Config

MAX_AGE_DAYS = 30
MAX_AGE_SECONDS = MAX_AGE_DAYS * 24 * 3600

cache_dir = Config().cache
now = time.time()

files = list(cache_dir.rglob("*"))
files = [f for f in files if f.is_file()]

if not files:
    print("Cache is empty — nothing to jitter.")
else:
    for path in files:
        age = random.uniform(0, MAX_AGE_SECONDS)
        new_mtime = now - age
        os.utime(path, (new_mtime, new_mtime))

    print(f"Jittered {len(files)} cache files across a {MAX_AGE_DAYS}-day window.")
