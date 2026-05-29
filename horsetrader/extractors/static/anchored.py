import functools
import re
from datetime import timedelta

from horsetrader.core import Config
from horsetrader.info import Logger

from . import store

logger = Logger.get(__name__)

# ISO-8601 duration, restricted to the components that map to a fixed
# `timedelta`. Years and months are deliberately unrepresentable here — they
# aren't a constant number of days — so `P1Y` / `P1M` fail to match and raise.
_DURATION = re.compile(
    r"^P(?=\d|T\d)(?:(\d+)W)?(?:(\d+)D)?(?:T(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$"
)


def _parse_duration(value: object, label: str) -> timedelta:
    """Parse an ISO-8601 duration (`P7D`, `P2W`, `PT12H`, …) to a `timedelta`.

    Curated data fails loud: an absent, non-string, year/month, or otherwise
    malformed value raises so the pipeline run is the editor's feedback loop.
    """
    if not isinstance(value, str):
        raise ValueError(f"{label}: duration must be an ISO-8601 string; got {value!r}")
    m = _DURATION.match(value)
    if m is None:
        raise ValueError(
            f"{label}: {value!r} is not a supported ISO-8601 duration "
            f"(weeks/days/hours/minutes/seconds only; no years/months)"
        )
    weeks, days, hours, minutes, seconds = (int(g) if g else 0 for g in m.groups())
    return timedelta(weeks=weeks, days=days, hours=hours, minutes=minutes, seconds=seconds)


def _relation(key: str, label: str) -> str:
    """Direction is carried by the key prefix (load-bearing by design).

    `during-` is a readability synonym for `after-` — a part that runs *during*
    a multi-part celebration reads more naturally than `after-` — and resolves
    to the same 'after' placement (starts at the anchor's end edge).
    """
    if key.startswith("before-"):
        return "before"
    if key.startswith(("after-", "during-")):
        return "after"
    raise ValueError(
        f"{label}: key must start with 'before-', 'after-', or 'during-'"
    )


@functools.cache
def load() -> list[dict]:
    """Records from anchored.yaml (curated lead-ins / extensions).

    Each record has key, relation ('before'|'after', from the key prefix),
    anchor (a stable key — resolved against other events at model-build time),
    name, duration (timedelta), a 'rewards' key (baked-shape mapping | None),
    and source. Periods are NOT resolved here — the anchor lives in another
    collection, so placement is the model's job (see Holiday/Anniversary).
    """
    filename = "anchored.yaml"
    source = str(Config().static / filename)
    records: list[dict] = []
    for key in store.load(filename):
        key = str(key)
        where = f"{source}: anchored event {key!r}"
        fields = store.shared(filename, key)

        anchor = fields.get("anchor")
        if not isinstance(anchor, str) or not anchor:
            raise ValueError(f"{where} is missing a string 'anchor'")

        rewards = fields.get("rewards")
        if rewards is not None and not isinstance(rewards, dict):
            raise ValueError(f"{where}: rewards must be a mapping")

        records.append({
            "key": key,
            "relation": _relation(key, where),
            "anchor": anchor,
            "name": str(fields.get("name", "")).strip() or None,
            "duration": _parse_duration(fields.get("duration"), where),
            "rewards": rewards,
            "source": source,
        })
    logger.info("Loaded %d anchored events from %s", len(records), filename)
    return records
