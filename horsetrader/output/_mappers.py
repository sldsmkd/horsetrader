from horsetrader.models.entities import (
    Bio,
    Character,
    Course,
    Race,
    Racetrack,
    Support,
    Trainee,
)

from horsetrader.models.entities.trainee import Aptitudes

from ._records import (
    AptitudesRecord,
    BioRecord,
    BirthdayRecord,
    CharacterRecord,
    CourseRecord,
    DistanceAptitudesRecord,
    RaceRecord,
    RacetrackRecord,
    StrategyAptitudesRecord,
    SurfaceAptitudesRecord,
    SupportRecord,
    ThreeSizesRecord,
    TraineeRecord,
)


def _search_aliases(character: Character | None, own: list[str]) -> list[str]:
    """An atom's baked search phrases: its character's nicknames (which apply to
    every card of that character) then its own card-specific ones, order-
    preserved and de-duplicated. Both halves are already on the models — Digitan
    enriches them at load — so this is a pure view, no source-data side-load."""
    character_aliases = character.aliases if character else []
    return list(dict.fromkeys([*character_aliases, *own]))


def _map_bio(b: Bio) -> BioRecord:
    """View the model `Bio` onto its wire record. The container is always
    present; its members may be `null`."""
    return BioRecord(
        three_sizes=ThreeSizesRecord(
            bust=b.three_sizes.bust,
            waist=b.three_sizes.waist,
            hips=b.three_sizes.hips,
        ),
        birthday=(
            BirthdayRecord(month=b.birthday.month, day=b.birthday.day)
            if b.birthday
            else None
        ),
        height=b.height,
    )


def _map_character(c: Character) -> CharacterRecord:
    return CharacterRecord(
        name=c.name,
        quote=c.quote,
        icon=str(c.icon.url) if c.icon else None,
        portrait=str(c.portrait.url) if c.portrait else None,
        bio=_map_bio(c.bio),
    )


def _map_racetrack(r: Racetrack) -> RacetrackRecord:
    return RacetrackRecord(
        name=r.name,
        icon=str(r.icon.url) if r.icon else None,
    )


def _map_course(c: Course) -> CourseRecord:
    return CourseRecord(
        racetrack=c.racetrack.key,
        surface=c.surface.value,
        distance=c.distance,
        variant=c.variant.value if c.variant else None,
        diagram=str(c.diagram.url) if c.diagram else None,
    )


def _map_race(r: Race) -> RaceRecord:
    return RaceRecord(
        name=r.name,
        grade=r.grade.value,
        surface=r.surface.value,
        distance=r.distance,
        racetrack=r.racetrack.key if r.racetrack else None,
        banner=str(r.banner.url) if r.banner else None,
    )


def _map_support(s: Support) -> SupportRecord:
    return SupportRecord(
        character=s.character.key if s.character else None,
        display=s.display,
        type=s.type.value if s.type else None,
        rarity=s.rarity.value if s.rarity else None,
        title=s.title,
        release=s.release.isoformat(),
        thumbnail=str(s.thumbnail.url) if s.thumbnail else None,
        art=str(s.art.url) if s.art else None,
        aliases=_search_aliases(s.character, s.aliases),
        source=s.source,
    )


def _map_aptitudes(a: Aptitudes | None) -> AptitudesRecord | None:
    """View the model `Aptitudes` onto the wire record, each grade as its rank
    slug (`g`…`s`). `None` passes straight through."""
    if a is None:
        return None
    return AptitudesRecord(
        surface=SurfaceAptitudesRecord(
            turf=a.surface.turf.value,
            dirt=a.surface.dirt.value,
        ),
        distance=DistanceAptitudesRecord(
            short=a.distance.short.value,
            mile=a.distance.mile.value,
            medium=a.distance.medium.value,
            long=a.distance.long.value,
        ),
        strategy=StrategyAptitudesRecord(
            front=a.strategy.front.value,
            pace=a.strategy.pace.value,
            late=a.strategy.late.value,
            end=a.strategy.end.value,
        ),
    )


def _map_trainee(t: Trainee) -> TraineeRecord:
    return TraineeRecord(
        character=t.character.key,
        variant=t.variant.variant.en,
        title=t.variant.title,
        rarity=t.variant.rarity,
        release=t.release.isoformat(),
        thumbnail=str(t.thumbnail.url) if t.thumbnail else None,
        portrait=str(t.portrait.url) if t.portrait else None,
        aliases=_search_aliases(t.character, t.aliases),
        source=t.source,
        aptitudes=_map_aptitudes(t.aptitudes),
    )


# Entities serialise through an exact-type lookup in `Bake._serialize` — no MRO
# walk, no base-class entry — so unlike events there's no contravariance to
# violate and the table stays. (Events own their wire shape via `Event.bake`.)
MAPPERS = {
    Character: _map_character,
    Course: _map_course,
    Race: _map_race,
    Racetrack: _map_racetrack,
    Support: _map_support,
    Trainee: _map_trainee,
}
