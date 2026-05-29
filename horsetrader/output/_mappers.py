from typing import Callable

from horsetrader.core import Japlish, Period
from horsetrader.models.entities import Character, Support, Trainee
from horsetrader.models.events import Banner, Event, Story
from horsetrader.models.rewards import Rewards


def _japlish(j: Japlish | None) -> str | None:
    if j is None:
        return None
    for attr in ("en", "jp"):
        try:
            return getattr(j, attr)
        except ValueError:
            pass
    return str(j)


def _rewards(rewards: Rewards | None) -> dict[str, int] | None:
    # Folds the heterogeneous Reward list back into the {key: value} shape
    # baked records expect. Same-keyed entries sum so callers can stamp
    # `[Carats(80), Carats(80)]` *or* `[Carats(160)]` and get the same
    # output. Non-counter rewards (no `amount`) will need a polymorphic hook
    # once the sequence-shaped reward lands; until then they're skipped.
    if not rewards:
        return None
    out: dict[str, int] = {}
    for r in rewards:
        amount = getattr(r, "amount", None)
        if amount is None:
            continue
        out[r.key] = out.get(r.key, 0) + amount
    return out or None


def _map_character(c: Character) -> dict:
    return {
        "name": _japlish(c.name),
        "quote": _japlish(c.quote),
        "icon": str(c.icon.url) if c.icon else None,
        "portrait": str(c.portrait.url) if c.portrait else None,
    }


def _map_support(s: Support) -> dict:
    return {
        "character": s.character.key if s.character else None,
        "display": _japlish(s.display),
        "type": s.type.value if s.type else None,
        "rarity": s.rarity.value if s.rarity else None,
        "title": _japlish(s.title),
        "release": s.release.isoformat(),
        "thumbnail": str(s.thumbnail.url) if s.thumbnail else None,
        "art": str(s.art.url) if s.art else None,
    }


def _map_trainee(t: Trainee) -> dict:
    return {
        "character": t.character.key,
        "variant": _japlish(t.variant.title),
        "rarity": t.variant.rarity,
        "release": t.release.isoformat(),
        "thumbnail": str(t.thumbnail.url) if t.thumbnail else None,
        "portrait": str(t.portrait.url) if t.portrait else None,
    }


def _map_banner(b: Banner, period: Period) -> dict:
    # Discriminator from the runtime class: SupportBanner → "support",
    # TraineeBanner → "trainee". Bare Banner shouldn't be instantiated; if it
    # is, fall back to "banner" so the output isn't empty-stringed.
    kind = type(b).__name__.lower().removesuffix("banner") or "banner"
    out: dict = {
        "start": period.start.date().isoformat(),
        "end": period.end.date().isoformat(),
        "predicted": period.predicted,
        "type": kind,
        "key": b.key,
        "contents": [c.key for c in b.contents],
        "image": f"/img/banners/{b.key}.webp",
    }
    if rewards := _rewards(b.rewards):
        out["rewards"] = rewards
    return out


def _map_story(s: Story, period: Period) -> dict:
    out: dict = {
        "start": period.start.date().isoformat(),
        "end": period.end.date().isoformat(),
        "predicted": period.predicted,
        "type": type(s).__name__.lower(),
        "key": s.key,
        "title": _japlish(s.title),
        "contents": [],
        "image": str(s.thumb.url) if s.thumb else None,
        "banner": str(s.banner.url) if s.banner else None,
        "art": str(s.art.url) if s.art else None,
    }
    if rewards := _rewards(s.rewards):
        out["rewards"] = rewards
    return out


MAPPERS = {
    Character: _map_character,
    Support: _map_support,
    Trainee: _map_trainee,
}

def _map_unmapped(e: Event, period: Period) -> dict:
    # Fallback when no concrete mapper is registered. Emits a bare record with
    # a `{classname}:unmapped` discriminator so the JSON loads cleanly and the
    # gaps are greppable downstream (`grep unmapped events.json | wc -l`).
    return {
        "start": period.start.date().isoformat(),
        "end": period.end.date().isoformat(),
        "predicted": period.predicted,
        "type": f"{type(e).__name__.lower()}:unmapped",
        "key": e.key,
    }


# Keyed by the base event class — subclasses (SupportBanner, TraineeBanner)
# resolve via MRO walk in `event_mapper()` so a single Banner entry covers them.
EVENT_MAPPERS: dict[type[Event], Callable[[Event, Period], dict]] = {
    Banner: _map_banner,
    Story: _map_story,
}


def event_mapper(event: Event) -> Callable[[Event, Period], dict]:
    """Resolve the mapper for `event` by walking its MRO, falling back to
    `_map_unmapped` so callers always get a callable."""
    for cls in type(event).__mro__:
        mapper = EVENT_MAPPERS.get(cls)
        if mapper is not None:
            return mapper
    return _map_unmapped
