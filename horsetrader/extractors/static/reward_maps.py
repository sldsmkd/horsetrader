import functools
import re

from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^reward-map-[a-z0-9-]+$")


@functools.cache
def load() -> dict[str, dict]:
    """Curated rank-graded reward maps, keyed ``reward-map-<slug>``.

    Region-agnostic. Each entry carries a ``tiers`` block: a rank-label →
    baked-rewards mapping (e.g. Team Trials' Class 1–6 + the ``5.5`` flapping
    tier, all free carats). Yayoi builds a `RewardStructure` per tier; Eishin
    bakes them under ``reward_maps`` in ``config.json``.

    Curated data fails loud: a map missing its ``tiers`` mapping raises. Selected
    by the ``reward-map-<slug>`` key shape, corpus-wide.
    """
    source = store.source()
    out: dict[str, dict] = {}
    for key in store.select(_KEY_PATTERN):
        tiers = store.shared(key).get("tiers")
        if not isinstance(tiers, dict) or not tiers:
            raise ValueError(
                f"{source}: reward map {key!r} is missing required 'tiers' mapping"
            )
        out[str(key)] = {"tiers": tiers}
    logger.info("Loaded %d reward maps", len(out))
    return out
