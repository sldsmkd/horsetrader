import functools
import re

from horsetrader.core import UTC, Period
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^banner-\d+$")


@functools.cache
def load() -> dict[str, Period]:
    """EN confirmed banner periods, keyed by ``banner-<id>``.

    Each entry's ``en`` block carries FQ ISO ``start`` / ``end`` (banners go
    live at 22:00 UTC and the close timestamp is stamped the same), so the
    `Period` is taken straight from the data. A banner with no ``en`` block has
    no confirmed EN window — the model leaves it predicted; this is normal for a
    future banner whose entry exists only to carry curated ``pulls`` ahead of
    its EN date. A banner whose ``en`` block *is* present but malformed fails
    loud (curated data). Selected by the ``banner-<id>`` key shape, corpus-wide.
    """
    source = store.source()
    out: dict[str, Period] = {}
    for key in store.select(_KEY_PATTERN):
        en_block = store.overlay(key, "en")
        if en_block is None:
            continue
        start = store.require_zone(
            en_block.get("start"), UTC, f"{source}: banner {key!r} en.start"
        )
        end = store.require_zone(
            en_block.get("end"), UTC, f"{source}: banner {key!r} en.end"
        )
        out[str(key)] = Period(start=start, span=end - start)
    logger.info("Loaded %d EN banner periods", len(out))
    return out


@functools.cache
def load_rewards() -> dict[str, dict]:
    """Curated per-banner rewards, keyed by ``banner-<id>``.

    Read from each banner entry's region-agnostic ``rewards`` block — a
    baked-shape mapping (e.g. ``{pulls: 4}``) in the same vocabulary every
    other curated event uses, so the model folds it in via the shared
    ``rewards_from_baked``. A banner without the block is absent. Returned raw
    (shape-checked only); the reward-key parse and the target→banner join are
    the `Banners` model's. Selected by the ``banner-<id>`` key shape, corpus-wide.
    """
    source = store.source()
    out: dict[str, dict] = {}
    for key in store.select(_KEY_PATTERN):
        rewards = store.shared(key).get("rewards")
        if rewards is None:
            continue
        if not isinstance(rewards, dict):
            raise ValueError(f"{source}: banner {key!r} rewards must be a mapping; got {rewards!r}")
        out[str(key)] = rewards
    logger.info("Loaded curated rewards for %d banners", len(out))
    return out
