import functools
import re

from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

_KEY_PATTERN = re.compile(r"^reward-structure-[a-z0-9-]+$")


@functools.cache
def load() -> dict[str, dict]:
    """Curated standing reward structures, keyed ``reward-structure-<slug>``.

    Region-agnostic: each entry carries a single ``shared`` ``rewards`` block in
    the baked-shape mapping (the model converts it to a `Rewards`, same as
    anchored events / showtimes). These are the procedural-stream *numbers* the
    client expands itself (it owns the cadence); they cross the wire in
    ``config.json``.

    Curated data fails loud: a structure missing its ``rewards`` raises so the
    editor sees it on the next run. Selected by the ``reward-structure-<slug>``
    key shape, corpus-wide.
    """
    source = store.source()
    out: dict[str, dict] = {}
    for key in store.select(_KEY_PATTERN):
        rewards = store.shared(key).get("rewards")
        if not rewards:
            raise ValueError(
                f"{source}: reward structure {key!r} is missing required 'rewards'"
            )
        out[str(key)] = {"rewards": rewards}
    logger.info("Loaded %d reward structures", len(out))
    return out
